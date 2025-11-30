import json
import calendar
import math
import time
from ortools.sat.python import cp_model

def load_data(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    return data

def prepare_data(data):
    full_time = data.get('full_time_hours', 184)
    for emp in data['employees']:
        # Handle cases where hours_fund is missing or None
        if 'hours_fund' not in emp or emp['hours_fund'] is None:
            ctype = emp.get('contract_type', 1.0)
            emp['hours_fund'] = full_time * ctype
    return data

def parse_time(t_str):
    h, m = map(int, t_str.split(':'))
    return h + m / 60.0

def fmt_time(t):
    h = int(t)
    m = int(round((t - h) * 60))
    return f"{h:02d}:{m:02d}"

def get_paid_hours(employee, closed_holidays, special_days):
    ctype = employee.get('contract_type', 1.0)
    if ctype >= 1.0: credit = 8.0
    elif ctype >= 0.75: credit = 6.0
    else: credit = 4.0
    
    paid_hours = 0
    paid_days = set()
    
    # 1. Fully closed holidays
    for h in closed_holidays:
        paid_hours += credit
        paid_days.add(h)
        
    # 2. Short Paid Holidays (store open, but paid holiday for everyone)
    for day_str, info in special_days.items():
        day = int(day_str)
        if info.get('type') == 'holiday_short_paid':
            if day not in paid_days:
                paid_hours += credit
                paid_days.add(day)
                
    # 3. Vacation days
    for v in employee.get('vacation_days', []):
        if v not in paid_days:
            paid_hours += credit
            paid_days.add(v)
            
    return paid_hours, paid_days, credit

def calculate_daily_staff_needs(employees, year, month, day, config, heavy_days=None):
    """
    Calculates required staff for a given day based on total hours fund.
    """
    # 1. Calculate Total Hours Fund
    total_hours_fund = 0
    for emp in employees:
        total_hours_fund += emp.get('hours_fund', 0)
        
    # 2. Estimate total shifts needed
    # Avg shift length ~9.5h
    total_shifts_needed = total_hours_fund / 9.5
    
    # 3. Distribute shifts across days
    _, num_days = calendar.monthrange(year, month)
    
    # Base staff per day
    avg_staff = total_shifts_needed / num_days
    
    # Adjust for weekends if requested
    weekday = calendar.weekday(year, month, day) # 0=Mon, 6=Sun
    
    if config.get('busy_weekends', False):
        # Fri, Sat, Sun need more staff
        if weekday >= 4: # Fri, Sat, Sun
            req_staff = math.ceil(avg_staff * 1.2)
        else:
            req_staff = math.floor(avg_staff * 0.9)
            if req_staff < 2: req_staff = 2
    else:
        req_staff = round(avg_staff)
        
    # Heavy Days Logic
    if heavy_days and str(day) in heavy_days:
        req_staff += heavy_days[str(day)].get('extra_staff', 0)
        
    return int(req_staff)

def generate_shift_templates(day, special_days, default_open=8.5, default_close=21.0):
    # Define possible shifts for a given day
    templates = []
    
    # Determine open/close times for this specific day
    open_time = default_open
    close_time = default_close
    
    if str(day) in special_days:
        sd = special_days[str(day)]
        if 'close' in sd:
            close_time = parse_time(sd['close'])
        if 'open' in sd:
            open_time = parse_time(sd['open'])
            
    # Special Short Day Logic (Fairness)
    # If day is significantly shorter than normal, maybe use FIXED shifts?
    # For now, let's stick to generating OPEN/CLOSE/FLEX based on the actual open/close times.
    
    # Calculate day length
    day_length = close_time - open_time
    
    if day_length <= 0:
        return [] # Should not happen if data is valid

    # If day is very short (e.g. < 6 hours), maybe just one shift type covering whole day?
    if day_length <= 6.0:
        templates.append({
            'type': 'FIXED', 'start': open_time, 'end': close_time, 'duration': day_length, 'cost': 0
        })
        return templates

    # Standard Shifts
    
    # Openers: Start at open_time. Lengths 6.0 to 10.5
    for duration in [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5]:
        end = open_time + duration
        if end <= close_time:
            # Gold Standard: ~9.5h
            if duration >= 9.5:
                cost = 0
            elif duration >= 8.0:
                cost = 20
            else:
                cost = 100
            
            # If it ends at close_time, it's technically a closer too, but let's keep it as OPEN 
            # if it starts at open_time. Or maybe FIXED? 
            # Current logic: OPEN starts at open_time.
            templates.append({'type': 'OPEN', 'start': open_time, 'end': end, 'duration': duration, 'cost': cost})
            
    # Closers: End at close_time. Lengths 6.0 to 11.0
    for duration in [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0]:
        start = close_time - duration
        
        # Constraint: Closer usually starts after noon or late morning.
        # Let's say closer shouldn't start before open_time.
        if start >= open_time:
             # Gold Standard: ~9.5-10h
             if duration >= 9.5:
                 cost = 0
             elif duration >= 8.5:
                 cost = 10
             elif duration >= 8.0:
                 cost = 50
             else:
                 cost = 100
                 
             # Penalize half-hour starts slightly
             if start % 1 != 0:
                 cost += 2
             
             # STRICT RULE: Any shift ending at close_time is a CLOSE shift (or OPEN if it covers full day)
             # We already added OPENs above. If an OPEN shift ends at close_time, it's fine to be called OPEN 
             # (it's the opener who stays till end). 
             # But here we generate specific CLOSE shifts.
             templates.append({'type': 'CLOSE', 'start': start, 'end': close_time, 'duration': duration, 'cost': cost})
                 
    # Flex: Start later than open, end before close
    # Start every 1 hour from open_time + 1.5h up to close_time - 6h
    
    start_hour_min = math.ceil(open_time + 1.0)
    start_hour_max = math.floor(close_time - 6.0)
    
    if start_hour_max >= start_hour_min:
        for start in range(start_hour_min, start_hour_max + 1):
            for duration in [6.0, 7.0, 8.0, 9.0, 10.0, 11.0]:
                end = start + duration
                
                # STRICT RULE: FLEX shift must NOT end at close_time.
                if end < close_time:
                    # Flex shifts
                    if duration >= 8.0:
                        base_cost = 0 
                    else:
                        base_cost = 20
                        
                    # Time Preference: Bias towards 10:00 - 19:00
                    # Penalty = weight * (abs(start - 10) + abs(end - 19))
                    # Let's use a weight of 5 per hour deviation
                    ideal_start = 10.0
                    ideal_end = 19.0
                    
                    dev_start = abs(start - ideal_start)
                    dev_end = abs(end - ideal_end)
                    
                    time_penalty = 5 * (dev_start + dev_end)
                    
                    cost = base_cost + int(time_penalty)
                    
                    templates.append({'type': 'FLEX', 'start': float(start), 'end': end, 'duration': duration, 'cost': cost})
    
    return templates

def solve_schedule(data_input):
    if isinstance(data_input, str):
        print("Loading data...")
        data = load_data(data_input)
    else:
        data = data_input

    # Ensure data is prepared (hours_fund calculated)
    data = prepare_data(data)

    employees = data['employees']
    year = data.get('year', 2025)
    month = data.get('month', 12)
    _, num_days = calendar.monthrange(year, month)
    
    config = data.get('config', {})
    closed_holidays = data.get('closed_holidays', [])
    special_days = data.get('special_days', {})
    heavy_days = data.get('heavy_days', {})
    weights = data.get('weights', {})
    
    print("Building model...")
    model = cp_model.CpModel()
    
    # Variables
    # work[emp, day, shift_idx] -> Bool
    work = {}
    
    # Pre-calculate templates for each day
    day_templates = {}
    
    default_open_str = config.get('default_open_time', '08:30')
    default_close_str = config.get('default_close_time', '21:00')
    default_open = parse_time(default_open_str)
    default_close = parse_time(default_close_str)
    
    for day in range(1, num_days + 1):
        # Skip fully closed holidays
        if day in closed_holidays:
            day_templates[day] = []
            continue
            
        # Check for special day type
        day_type = 'normal'
        if str(day) in special_days:
            day_type = special_days[str(day)].get('type', 'normal')
            
        # If it's a closed holiday (handled by closed_holidays list usually, but check type too)
        if day_type == 'holiday_closed':
            day_templates[day] = []
            continue
            
        day_templates[day] = generate_shift_templates(day, special_days, default_open, default_close)
        
    print(f"Generated templates. Max templates per day: {max(len(t) for t in day_templates.values() if t)}")
    
    # Create variables
    for i, emp in enumerate(employees):
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            
            # Check availability
            if day in emp.get('unavailable_days', []) or day in emp.get('vacation_days', []):
                continue
                
            for s_idx, template in enumerate(day_templates[day]):
                work[(i, day, s_idx)] = model.NewBoolVar(f'work_{i}_{day}_{s_idx}')
                
    print(f"Created {len(work)} variables.")
    
    # Constraints
    
    # 1. Max one shift per day per employee
    for i in range(len(employees)):
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            
            shifts = []
            for s_idx in range(len(day_templates[day])):
                if (i, day, s_idx) in work:
                    shifts.append(work[(i, day, s_idx)])
            
            if shifts:
                model.Add(sum(shifts) <= 1)
                
    # 2. Daily Staffing Requirements
    day_shape_vars = []
    understaff_info = {} # day -> {needed, available, deficit}
    
    # Manager roles
    manager_roles = config.get('manager_roles', ["manager", "deputy", "supervisor"])
    manager_ids = [i for i, emp in enumerate(employees) if emp.get('role') in manager_roles]
    
    for day in range(1, num_days + 1):
        if day in closed_holidays: continue
        
        req_staff = calculate_daily_staff_needs(employees, year, month, day, config, heavy_days)
        if str(day) in special_days:
            req_staff = special_days[str(day)].get('staff', req_staff)
            
        # Cap at available employees (to avoid infeasibility)
        available_count = 0
        for i, emp in enumerate(employees):
             if day not in emp.get('unavailable_days', []) and day not in emp.get('vacation_days', []):
                 available_count += 1
        
        if req_staff > available_count:
            deficit = req_staff - available_count
            understaff_info[day] = {
                "needed": req_staff,
                "available": available_count,
                "deficit": deficit
            }
            req_staff = available_count
            
        # Day Shape Targets (Proportional)
        open_ratio = config.get('open_ratio', 0.4)
        close_ratio = config.get('close_ratio', 0.4)
        min_openers = config.get('min_openers', 1)
        min_closers = config.get('min_closers', 1)
        
        target_open = max(min_openers, int(round(req_staff * open_ratio)))
        target_close = max(min_closers, int(round(req_staff * close_ratio)))
        target_middle = req_staff - target_open - target_close
        
        # Overflow handling if middle < 0
        if target_middle < 0:
            overflow = -target_middle
            
            # Reduce closes first, but not below min
            reducible_close = max(0, target_close - min_closers)
            reduce_c = min(overflow, reducible_close)
            target_close -= reduce_c
            overflow -= reduce_c
            
            if overflow > 0:
                # Reduce opens next
                reducible_open = max(0, target_open - min_openers)
                reduce_o = min(overflow, reducible_open)
                target_open -= reduce_o
                overflow -= reduce_o
                
            target_middle = req_staff - target_open - target_close
            if target_middle < 0:
                target_middle = 0
                
        # Total Staff
        day_shifts = []
        openers = []
        closers = []
        middles = [] # Track middles for day shape
        
        for i in range(len(employees)):
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    var = work[(i, day, s_idx)]
                    day_shifts.append(var)
                    if template['type'] == 'OPEN' or template['type'] == 'FIXED': 
                        openers.append(var)
                    if template['type'] == 'CLOSE' or template['type'] == 'FIXED':
                        closers.append(var)
                    if template['type'] == 'FLEX':
                        middles.append(var)
                        
        model.Add(sum(day_shifts) == req_staff)
        
        # Manager on Mondays
        weekday = calendar.weekday(year, month, day)
        if weekday == 0: # Monday
            management_vars = []
            for i in manager_ids:
                for s_idx, template in enumerate(day_templates[day]):
                    if (i, day, s_idx) in work:
                        management_vars.append(work[(i, day, s_idx)])
            
            if management_vars:
                model.Add(sum(management_vars) >= 1)
        
        # Min Openers/Closers (Hard Constraint)
        model.Add(sum(openers) >= min_openers)
        model.Add(sum(closers) >= min_closers)
        
        # Day Shape Soft Constraints
        o_day = model.NewIntVar(0, req_staff, f'openers_day_{day}')
        c_day = model.NewIntVar(0, req_staff, f'closers_day_{day}')
        m_day = model.NewIntVar(0, req_staff, f'middles_day_{day}')
        
        model.Add(o_day == sum(openers))
        model.Add(c_day == sum(closers))
        # Middle count is remainder (to handle Fixed shifts correctly if they are neither open nor close in some future logic, 
        # though currently Fixed are both. But for day shape, we want the structural middle).
        # Actually, user requested: m_day = req_staff - o_day - c_day
        # But wait, Fixed shifts are added to BOTH openers and closers lists above.
        # So o_day + c_day > req_staff if there are fixed shifts.
        # Let's stick to the user's request: "m_day = model.NewIntVar... model.Add(m_day == req_staff - o_day - c_day)"
        # BUT if Fixed shifts are counted as both, then o+c > req.
        # Let's use the explicit 'middles' list (FLEX shifts) which I collected above.
        # This is safer and semantically cleaner.
        model.Add(m_day == sum(middles))
        
        # Open deviation
        o_dev = model.NewIntVar(0, req_staff, f'o_dev_{day}')
        # model.Add(o_dev >= o_day - target_open)
        # model.Add(o_dev >= target_open - o_day)
        # Using AddAbsEquality is cleaner if we have a diff var, but user suggested >= style.
        # Let's use the >= style for direct deviation.
        model.Add(o_dev >= o_day - target_open)
        model.Add(o_dev >= target_open - o_day)
        
        # Close deviation
        c_dev = model.NewIntVar(0, req_staff, f'c_dev_{day}')
        model.Add(c_dev >= c_day - target_close)
        model.Add(c_dev >= target_close - c_day)
        
        # Middle deviation
        m_dev = model.NewIntVar(0, req_staff, f'm_dev_{day}')
        model.Add(m_dev >= m_day - target_middle)
        model.Add(m_dev >= target_middle - m_day)
        
        day_shape_vars.extend([o_dev, c_dev, m_dev])
        
    # 3. Consecutive Days (Max 4)
    # Optimization: Create worked_day variables once
    worked_days = {} # (i, day) -> BoolVar
    
    for i in range(len(employees)):
        for day in range(1, num_days + 1):
            if day in closed_holidays:
                continue
                
            day_vars = []
            for s_idx in range(len(day_templates[day])):
                if (i, day, s_idx) in work:
                    day_vars.append(work[(i, day, s_idx)])
            
            if day_vars:
                wd = model.NewBoolVar(f'worked_{i}_{day}')
                model.Add(sum(day_vars) == wd)
                worked_days[(i, day)] = wd

    for i in range(len(employees)):
        for day in range(1, num_days - 3): 
            window_vars = []
            for d in range(day, day + 5):
                if (i, d) in worked_days:
                    window_vars.append(worked_days[(i, d)])
            
            if len(window_vars) == 5:
                model.Add(sum(window_vars) <= 4)
                
    # 4. Soft Clopen Ban
    clopen_vars = []
    if config.get('enable_clopen_ban', True):
        for i in range(len(employees)):
            for day in range(1, num_days):
                if day in closed_holidays or (day+1) in closed_holidays:
                    continue
                    
                close_vars = []
                for s_idx, t in enumerate(day_templates[day]):
                    if t['type'] in ('CLOSE', 'FIXED'):
                        if (i, day, s_idx) in work:
                            close_vars.append(work[(i, day, s_idx)])
                            
                open_vars_next = []
                for s_idx, t in enumerate(day_templates.get(day+1, [])):
                    if t['type'] in ('OPEN', 'FIXED'):
                        if (i, day+1, s_idx) in work:
                            open_vars_next.append(work[(i, day+1, s_idx)])
                            
                if close_vars and open_vars_next:
                    has_close = model.NewBoolVar(f'has_close_{i}_{day}')
                    model.AddMaxEquality(has_close, close_vars)
                    
                    has_open_next = model.NewBoolVar(f'has_open_{i}_{day+1}')
                    model.AddMaxEquality(has_open_next, open_vars_next)
                    
                    clopen = model.NewBoolVar(f'clopen_{i}_{day}')
                    model.AddBoolAnd([has_close, has_open_next]).OnlyEnforceIf(clopen)
                    model.AddBoolOr([has_close.Not(), has_open_next.Not(), clopen])
                    
                    clopen_vars.append(clopen)

    # Fairness
    fairness_vars = []
    open_counts = []
    close_counts = []
    
    for i, emp in enumerate(employees):
        emp_opens = []
        emp_closes = []
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    var = work[(i, day, s_idx)]
                    if template['type'] == 'OPEN' or template['type'] == 'FIXED':
                        emp_opens.append(var)
                    if template['type'] == 'CLOSE' or template['type'] == 'FIXED':
                        emp_closes.append(var)
                        
        o_count = model.NewIntVar(0, num_days, f'open_count_{i}')
        c_count = model.NewIntVar(0, num_days, f'close_count_{i}')
        model.Add(o_count == sum(emp_opens))
        model.Add(c_count == sum(emp_closes))
        open_counts.append(o_count)
        close_counts.append(c_count)
        
        # 1. Balance: |Open - Close|
        diff_oc = model.NewIntVar(-num_days, num_days, f'diff_oc_{i}')
        abs_diff_oc = model.NewIntVar(0, num_days, f'abs_diff_oc_{i}')
        model.Add(diff_oc == o_count - c_count)
        model.AddAbsEquality(abs_diff_oc, diff_oc)
        fairness_vars.append(abs_diff_oc)
        
        # 2. Target
        fund = emp['hours_fund']
        target_shifts = fund / 9.5
        target_ops = int(round(target_shifts / 2))
        
        diff_o_t = model.NewIntVar(-num_days, num_days, f'diff_o_t_{i}')
        abs_diff_o_t = model.NewIntVar(0, num_days, f'abs_diff_o_t_{i}')
        model.Add(diff_o_t == o_count - target_ops)
        model.AddAbsEquality(abs_diff_o_t, diff_o_t)
        fairness_vars.append(abs_diff_o_t)
        
        diff_c_t = model.NewIntVar(-num_days, num_days, f'diff_c_t_{i}')
        abs_diff_c_t = model.NewIntVar(0, num_days, f'abs_diff_c_t_{i}')
        model.Add(diff_c_t == c_count - target_ops)
        model.AddAbsEquality(abs_diff_c_t, diff_c_t)
        fairness_vars.append(abs_diff_c_t)

    # Objective
    paid_hours = {}
    targets = {}
    for i, emp in enumerate(employees):
        ph, _, _ = get_paid_hours(emp, closed_holidays, special_days)
        paid_hours[i] = ph
        targets[i] = emp['hours_fund']
        
    obj_vars = []
    for i in range(len(employees)):
        worked_terms = []
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    duration_int = int(template['duration'] * 10)
                    worked_terms.append(work[(i, day, s_idx)] * duration_int)
        total_worked = sum(worked_terms)
        target_int = int((targets[i] - paid_hours[i]) * 10)
        diff = model.NewIntVar(-10000, 10000, f'diff_{i}')
        abs_diff = model.NewIntVar(0, 10000, f'abs_diff_{i}')
        model.Add(diff == total_worked - target_int)
        model.Add(abs_diff >= diff)
        model.Add(abs_diff >= -diff)
        obj_vars.append(abs_diff)
        
    cost_vars = []
    for day in range(1, num_days + 1):
        if day in closed_holidays: continue
        for i in range(len(employees)):
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    cost = template.get('cost', 0)
                    if cost > 0:
                        cost_vars.append(work[(i, day, s_idx)] * cost)
                        
    # Weighting
    w_hours = weights.get('work_hours', 1000)
    w_shape = weights.get('day_shape', 80)
    w_cost = weights.get('shift_cost', 5)
    w_fair = weights.get('open_close_fairness', 3) # Was 5
    w_clopen = weights.get('clopen', 15)
    
    model.Minimize(
        sum(obj_vars) * w_hours + 
        sum(cost_vars) * w_cost + 
        sum(day_shape_vars) * w_shape + 
        sum(fairness_vars) * w_fair +
        sum(clopen_vars) * w_clopen
    )
    
    # Solve
    print("Solving...")
    solver = cp_model.CpSolver()
    
    # Configurable time limit
    import os
    time_limit = int(os.environ.get('SCHEDULER_SOLVER_TIME_LIMIT_SECONDS', 300))
    solver.parameters.max_time_in_seconds = float(time_limit)
    
    # Stop if within 5% of optimal
    solver.parameters.relative_gap_limit = 0.05
    
    status = solver.Solve(model)
    
    result = {
        "status": solver.StatusName(status),
        "solver_status": solver.StatusName(status),
        "solve_time_seconds": solver.WallTime(),
        "best_bound": solver.BestObjectiveBound(),
        "objective_value": solver.ObjectiveValue(),
        "schedule": {},
        "employees": [],
        "understaffed": []
    }

    if understaff_info:
        print("\n=== WARNING: Understaffed Days ===")
        for day, info in sorted(understaff_info.items()):
            print(f"Day {day}: needed {info['needed']} but only {info['available']} available, deficit {info['deficit']}")
            result["understaffed"].append({
                "day": day,
                "needed": info['needed'],
                "available": info['available'],
                "deficit": info['deficit']
            })

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print(f"Solution found! Status: {solver.StatusName(status)}")
        print(f"Objective Value: {solver.ObjectiveValue()}")
        
        # Build schedule dict
        schedule = {}
        employee_work_hours = {i: 0.0 for i in range(len(employees))}
        
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            
            daily_shifts = {}
            for i in range(len(employees)):
                for s_idx, template in enumerate(day_templates[day]):
                    if (i, day, s_idx) in work:
                        if solver.Value(work[(i, day, s_idx)]):
                            daily_shifts[i] = template
                            employee_work_hours[i] += template['duration']
                            
            schedule[day] = daily_shifts
            
        # Format schedule for return
        # We need a JSON serializable format.
        # Structure: { day: { employee_name: { start, end, type, duration } } }
        
        schedule_output = {}
        for day, shifts in schedule.items():
            day_data = {}
            for i, template in shifts.items():
                emp_name = employees[i]['name']
                day_data[emp_name] = {
                    "start": fmt_time(template['start']),
                    "end": fmt_time(template['end']),
                    "type": template['type'],
                    "duration": template['duration']
                }
            schedule_output[str(day)] = day_data
            
        result["schedule"] = schedule_output
        
        # Employee Stats
        emp_stats = []
        for i, emp in enumerate(employees):
            worked = employee_work_hours[i]
            paid = paid_hours[i]
            total = worked + paid
            target = emp['hours_fund']
            diff = total - target
            
            opens = 0
            closes = 0
            middle = 0
            for day, shifts in schedule.items():
                if i in shifts:
                    t = shifts[i]
                    if t['type'] == 'OPEN': opens += 1
                    elif t['type'] == 'CLOSE': closes += 1
                    elif t['type'] == 'FIXED': 
                        opens += 1
                        closes += 1
                    else: middle += 1
            
            emp_stats.append({
                "name": emp['name'],
                "worked": worked,
                "paid_off": paid,
                "total": total,
                "target": target,
                "diff": diff,
                "opens": opens,
                "closes": closes,
                "middle": middle
            })
            
        result["employees"] = emp_stats
        
    else:
        print("No solution found.")
        
    return result

def print_schedule(result):
    if result.get("status") not in ("OPTIMAL", "FEASIBLE"):
        print(f"No solution found. Status: {result.get('status')}")
        return

    # We need to reconstruct some context to print nicely, but the result has most info.
    # However, the original print_matrix used the raw employee list and schedule dict with indices.
    # To keep it simple, we can just print a JSON dump or a simplified table if needed.
    # For now, let's just print a summary.
    
    print("\n=== SCHEDULE GENERATED ===")
    print(f"Status: {result['status']}")
    print(f"Objective: {result['objective_value']}")
    
    # Re-implement a basic print if needed, or rely on frontend.
    # Since we are moving to API, console output is less critical.
    # But let's print the stats at least.
    
    print("\nEmployee Stats:")
    print(f"{'Name':<10} | {'Worked':<8} | {'Paid Off':<8} | {'Total':<8} | {'Target':<8} | {'Diff':<8} | {'Opens':<5} | {'Closes':<5} | {'Middle':<5}")
    print("-" * 100)
    for emp in result['employees']:
        print(f"{emp['name']:<10} | {emp['worked']:<8.1f} | {emp['paid_off']:<8.1f} | {emp['total']:<8.1f} | {emp['target']:<8} | {emp['diff']:<+8.1f} | {emp['opens']:<5} | {emp['closes']:<5} | {emp['middle']:<5}")

if __name__ == "__main__":
    res = solve_schedule('data_scalable.json')
    print_schedule(res)
