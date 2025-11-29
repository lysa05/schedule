import json
import calendar
from ortools.sat.python import cp_model

def load_data(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    full_time = data.get('full_time_hours', 184)
    for emp in data['employees']:
        if 'hours_fund' not in emp:
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

def get_paid_hours(employee, closed_holidays):
    ctype = employee.get('contract_type', 1.0)
    if ctype >= 1.0: credit = 8.0
    elif ctype >= 0.75: credit = 6.0
    else: credit = 4.0
    
    paid_hours = 0
    paid_days = set()
    for h in closed_holidays:
        paid_hours += credit
        paid_days.add(h)
    for v in employee.get('vacation_days', []):
        if v not in paid_days:
            paid_hours += credit
            paid_days.add(v)
    return paid_hours, paid_days, credit

def calculate_daily_staff_needs(employees, year, month, day, config):
    if not config.get('auto_staffing', False):
        return config.get('default_staff_count', 4)
    
    total_fund = sum(e['hours_fund'] for e in employees)
    _, num_days = calendar.monthrange(year, month)
    daily_hours_needed = total_fund / num_days
    
    # User wants longer shifts (approx 9.5 - 10h).
    # If we assume 8h, we demand too many staff, forcing short shifts to fit the budget.
    # Changing assumption to 9.5h to allow for "Gold Standard" shifts.
    avg_shift_len = 9.5 
    base_staff = round(daily_hours_needed / avg_shift_len)
    req_staff = max(2, int(base_staff))
    
    if config.get('busy_weekends', False):
        weekday = calendar.weekday(year, month, day)
        if weekday >= 4: # Fri, Sat, Sun
            req_staff += 1
            
    return req_staff

def generate_shift_templates(day, special_days):
    # Define possible shifts for a given day
    templates = []
    
    close_time = 21.0
    is_special = False
    if str(day) in special_days:
        close_time = parse_time(special_days[str(day)].get('close', '21:00'))
        is_special = True
        
    # Special Short Day Logic (Fairness)
    if is_special and close_time <= 18.0:
        # Everyone works full shift 08:30 - close_time
        duration = close_time - 8.5
        templates.append({
            'type': 'FIXED', 'start': 8.5, 'end': close_time, 'duration': duration, 'cost': 0
        })
        return templates

    # Standard Shifts
    # User preference: "Better fewer shifts but longer (+- 10 hours)"
    
    # Openers: Start 08:30. Lengths 6.0 to 10.5 (step 0.5)
    for duration in [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5]:
        end = 8.5 + duration
        if end <= min(19.0, close_time):
            # Gold Standard: 08:30-18:00 (9.5h) or 08:30-19:00 (10.5h)
            if duration >= 9.5:
                cost = 0
            elif duration >= 8.0:
                cost = 20
            else:
                cost = 100
                
            templates.append({'type': 'OPEN', 'start': 8.5, 'end': end, 'duration': duration, 'cost': cost})
            
    # Closers: End at close_time. Lengths 6.0 to 11.0
    # Min length for closer is usually 8.0, but let's allow 6.0 if needed
    for duration in [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0]:
        start = close_time - duration
        
        # Constraint: Closer must start by 13:00.
        # Also must start after shop opens (08:30).
        if start <= 13.0 and start >= 8.5:
             # Gold Standard: 11:00-21:00 (10h)
             # We need intermediate shifts to hit exact hours targets (e.g. 184h).
             # If we only have 10h shifts, we can only get 180 or 190.
             # We add 9.5h, 9.0h, 8.5h with increasing costs to allow fine-tuning.
             
             if duration >= 9.5:
                 cost = 0          # Ideal (10h, 10.5h, 11h) or (9.5h)
             elif duration == 9.0:
                 cost = 5          # Good (12:00 start)
             elif duration == 8.5:
                 cost = 10         # Okay (12:30 start)
             elif duration == 8.0:
                 cost = 50         # Discouraged (13:00 start) - Use only if needed for hours
             else:
                 cost = 100        # Short shifts
                 
             # Penalize half-hour starts slightly to prefer whole hours if possible
             # But don't make it too expensive, or we lose the granularity benefit
             if start % 1 != 0:
                 cost += 2
                 
             templates.append({'type': 'CLOSE', 'start': start, 'end': close_time, 'duration': duration, 'cost': cost})
                 
    # Flex: Start 10:00 - 13:00. Lengths 6.0 - 11.0
    # Reduce resolution to avoid explosion?
    # Start every 1 hour: 10, 11, 12, 13
    # Duration every 1 hour: 6, 7, 8, 9, 10, 11
    for start in [10.0, 11.0, 12.0, 13.0]:
        for duration in [6.0, 7.0, 8.0, 9.0, 10.0, 11.0]:
            end = start + duration
            if end <= close_time:
                # Flex shifts are discouraged but allowed if needed for balance
                if duration >= 8.0:
                    cost = 15 # Moderate cost (was 50)
                else:
                    cost = 50 # Higher cost for short flex (was 150)
                templates.append({'type': 'FLEX', 'start': start, 'end': end, 'duration': duration, 'cost': cost})
                
    return templates

def solve_schedule(data_file):
    print("Loading data...")
    data = load_data(data_file)
    employees = data['employees']
    year = data.get('year', 2025)
    month = data.get('month', 12)
    _, num_days = calendar.monthrange(year, month)
    
    config = data.get('config', {})
    closed_holidays = data.get('closed_holidays', [])
    special_days = data.get('special_days', {})
    
    print("Building model...")
    model = cp_model.CpModel()
    
    # Variables
    # work[emp, day, shift_idx] -> Bool
    work = {}
    
    # Pre-calculate templates for each day
    day_templates = {}
    for day in range(1, num_days + 1):
        if day in closed_holidays:
            day_templates[day] = []
            continue
        day_templates[day] = generate_shift_templates(day, special_days)
        
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
    
    for day in range(1, num_days + 1):
        if day in closed_holidays: continue
        
        req_staff = calculate_daily_staff_needs(employees, year, month, day, config)
        if str(day) in special_days:
            req_staff = special_days[str(day)].get('staff', req_staff)
            
        # Cap at available employees (to avoid infeasibility)
        available_count = 0
        for i, emp in enumerate(employees):
             if day not in emp.get('unavailable_days', []) and day not in emp.get('vacation_days', []):
                 available_count += 1
        
        if req_staff > available_count:
            req_staff = available_count
            
        # Day Shape Targets (38% Open, 38% Close, ~24% Middle)
        min_openers = config.get('min_openers', 1)
        min_closers = config.get('min_closers', 1)
        
        target_open = max(min_openers, int(round(req_staff * 0.38)))
        target_close = max(min_closers, int(round(req_staff * 0.38)))
        
        # Correction loop
        while target_open + target_close > req_staff:
            if target_open > min_openers:
                target_open -= 1
            elif target_close > min_closers:
                target_close -= 1
            else:
                break
                
        # Total Staff
        day_shifts = []
        openers = []
        closers = []
        
        for i in range(len(employees)):
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    var = work[(i, day, s_idx)]
                    day_shifts.append(var)
                    if template['type'] == 'OPEN' or template['type'] == 'FIXED': # Fixed on short days counts as open?
                        openers.append(var)
                    if template['type'] == 'CLOSE' or template['type'] == 'FIXED':
                        closers.append(var)
                        
        model.Add(sum(day_shifts) == req_staff)
        
        # Min Openers/Closers (Hard Constraint)
        model.Add(sum(openers) >= min_openers)
        model.Add(sum(closers) >= min_closers)
        
        # Day Shape Soft Constraints
        o_day = model.NewIntVar(0, req_staff, f'openers_day_{day}')
        c_day = model.NewIntVar(0, req_staff, f'closers_day_{day}')
        
        model.Add(o_day == sum(openers))
        model.Add(c_day == sum(closers))
        
        # Open deviation
        o_diff = model.NewIntVar(-req_staff, req_staff, f'o_diff_{day}')
        o_abs = model.NewIntVar(0, req_staff, f'o_abs_{day}')
        model.Add(o_diff == o_day - target_open)
        model.AddAbsEquality(o_abs, o_diff)
        
        # Close deviation
        c_diff = model.NewIntVar(-req_staff, req_staff, f'c_diff_{day}')
        c_abs = model.NewIntVar(0, req_staff, f'c_abs_{day}')
        model.Add(c_diff == c_day - target_close)
        model.AddAbsEquality(c_abs, c_diff)
        
        day_shape_vars.extend([o_abs, c_abs])
        
    # 3. Consecutive Days (Max 4)
    # Optimization: Create worked_day variables once
    worked_days = {} # (i, day) -> BoolVar
    
    for i in range(len(employees)):
        for day in range(1, num_days + 1):
            if day in closed_holidays:
                # If closed, they definitely didn't work
                # But for window calculation, it counts as 0
                continue
                
            day_vars = []
            for s_idx in range(len(day_templates[day])):
                if (i, day, s_idx) in work:
                    day_vars.append(work[(i, day, s_idx)])
            
            if day_vars:
                wd = model.NewBoolVar(f'worked_{i}_{day}')
                model.Add(sum(day_vars) == wd)
                worked_days[(i, day)] = wd
            else:
                # No possible shifts (unavailable), so worked=0
                # We don't need a variable, just treat as 0 in loop
                pass

    for i in range(len(employees)):
        for day in range(1, num_days - 3): # Check windows of 5 days
            # If worked d, d+1, d+2, d+4, d+4 -> Sum is 5 -> Forbidden
            # So Sum(d..d+4) <= 4
            window_vars = []
            for d in range(day, day + 5):
                if (i, d) in worked_days:
                    window_vars.append(worked_days[(i, d)])
            
            if len(window_vars) == 5:
                model.Add(sum(window_vars) <= 4)

    # Fairness: Open/Close Balance (Linear)
    # 1. Balance within employee: Minimize |Open - Close|
    # 2. Balance vs Target: Minimize |Open - Target| + |Close - Target|
    
    fairness_vars = []
    
    # Calculate ideal target per employee based on FTE
    # Avg shift length ~9.5h. 
    # Target Shifts = Hours Fund / 9.5
    # Target Opens = Target Shifts / 2
    
    open_counts = []
    close_counts = []
    
    for i, emp in enumerate(employees):
        # Count opens and closes for this employee
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
                        
        # Create variables for counts
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
        
        # 2. Target: |Open - Target| + |Close - Target|
        # Estimate target
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

    # Objective: Minimize Deviation from Target Hours
    
    # Calculate Paid Hours first
    paid_hours = {}
    targets = {}
    for i, emp in enumerate(employees):
        ph, _, _ = get_paid_hours(emp, closed_holidays)
        paid_hours[i] = ph
        targets[i] = emp['hours_fund']
        
    # Total Worked Hours Variable
    total_worked_vars = []
    
    # We want to minimize sum(abs(worked - target))
    # Linearize abs:
    # diff = worked - target
    # abs_diff >= diff
    # abs_diff >= -diff
    # minimize sum(abs_diff)
    
    obj_vars = []
    
    for i in range(len(employees)):
        # Sum of duration * variable
        worked_terms = []
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    # Duration is float, CP-SAT needs int. Scale by 10 (0.5h -> 5)
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
        
    # Secondary Objective: Minimize Shift Costs (Preferences)
    cost_vars = []
    for day in range(1, num_days + 1):
        if day in closed_holidays: continue
        for i in range(len(employees)):
            for s_idx, template in enumerate(day_templates[day]):
                if (i, day, s_idx) in work:
                    cost = template.get('cost', 0)
                    if cost > 0:
                        cost_vars.append(work[(i, day, s_idx)] * cost)
                        
    # Weighting:
    # 1. Hours Deviation (Weight 1000) - Absolute Priority
    # 2. Day Shape (Weight 40) - Strong preference for 38/38/24 split (Increased from 10)
    # 3. Shift Costs (Weight 10) - Reduced from 20 to allow Flex shifts to win
    # 4. Fairness (Weight 5) - Tie-breaker
    
    model.Minimize(sum(obj_vars) * 1000 + sum(cost_vars) * 10 + sum(day_shape_vars) * 40 + sum(fairness_vars) * 5)
    
    # Solve
    print("Solving...")
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print(f"Solution found! Status: {solver.StatusName(status)}")
        print(f"Objective Value: {solver.ObjectiveValue()}")
        
        # Build schedule dict for printing
        schedule = {}
        employee_work_hours = {i: 0.0 for i in range(len(employees))}
        
        print("\n=== DAY SHAPE DEBUG ===")
        
        for day in range(1, num_days + 1):
            if day in closed_holidays: continue
            
            # Re-calculate targets for debug
            req_staff = calculate_daily_staff_needs(employees, year, month, day, config)
            if str(day) in special_days:
                req_staff = special_days[str(day)].get('staff', req_staff)
            
            # Cap at available
            available_count = 0
            for i, emp in enumerate(employees):
                 if day not in emp.get('unavailable_days', []) and day not in emp.get('vacation_days', []):
                     available_count += 1
            if req_staff > available_count: req_staff = available_count
            
            min_openers = config.get('min_openers', 1)
            min_closers = config.get('min_closers', 1)
            target_open = max(min_openers, int(round(req_staff * 0.38)))
            target_close = max(min_closers, int(round(req_staff * 0.38)))
            while target_open + target_close > req_staff:
                if target_open > min_openers: target_open -= 1
                elif target_close > min_closers: target_close -= 1
                else: break
            target_middle = req_staff - target_open - target_close
            
            daily_shifts = {}
            actual_open = 0
            actual_close = 0
            actual_middle = 0
            
            for i in range(len(employees)):
                for s_idx, template in enumerate(day_templates[day]):
                    if (i, day, s_idx) in work:
                        if solver.Value(work[(i, day, s_idx)]):
                            daily_shifts[i] = template
                            employee_work_hours[i] += template['duration']
                            
                            t_type = template['type']
                            if t_type == 'OPEN' or t_type == 'FIXED': actual_open += 1
                            elif t_type == 'CLOSE': actual_close += 1 # Fixed is usually open-to-close, count as open? Or both?
                            # Actually FIXED is usually full day. Let's count as Open for simplicity or check logic.
                            # In constraint, FIXED was added to openers AND closers.
                            # Here let's just use type.
                            else: actual_middle += 1
                            
                            # Correction for FIXED in debug counts to match constraints
                            if t_type == 'FIXED': actual_close += 1 
                            
            schedule[day] = daily_shifts
            
            o_abs = abs(actual_open - target_open)
            c_abs = abs(actual_close - target_close)
            
            print(f"Day {day}: Staff {req_staff} | Target O/C/M: {target_open}/{target_close}/{target_middle} | Actual: {actual_open}/{actual_close}/{actual_middle} | Dev: {o_abs}/{c_abs}")
            
        # Print using existing format logic (simplified)
        print_matrix(schedule, employees, year, month, num_days, employee_work_hours, paid_hours, closed_holidays, data.get('open_holidays', []), special_days)
        
    else:
        print("No solution found.")

def print_matrix(schedule, employees, year, month, num_days, work_hours, paid_hours_map, closed_holidays, open_holidays, special_days):
    names = [e['name'] for e in employees]
    col_width = 15
    header = f"{'Day':<8} | " + " | ".join([f"{n:^{col_width}}" for n in names])
    print("\n" + header)
    print("-" * len(header))
    
    days_of_week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    for day in range(1, num_days + 1):
        weekday = calendar.weekday(year, month, day)
        day_str = f"{day} {days_of_week[weekday]}"
        
        day_label = day_str
        if day in open_holidays: day_label += "*"
        if str(day) in special_days: day_label += "!"
            
        row = f"{day_label:<8} | "
        day_shifts = schedule.get(day, {})
        
        cells = []
        for i, emp in enumerate(employees):
            if day in closed_holidays:
                # Need to calculate credit again or pass it? 
                # We passed paid_hours_map which is total. 
                # Just show HOL
                _, _, credit = get_paid_hours(emp, closed_holidays)
                cells.append(f"{f'HOL ({int(credit)}h)':^{col_width}}")
            elif day in emp.get('vacation_days', []):
                 _, _, credit = get_paid_hours(emp, closed_holidays)
                 cells.append(f"{f'VAC ({int(credit)}h)':^{col_width}}")
            elif i in day_shifts:
                s = day_shifts[i]
                time_range = f"{fmt_time(s['start'])}-{fmt_time(s['end'])}"
                cells.append(f"{time_range:^{col_width}}")
            elif day in emp.get('unavailable_days', []):
                cells.append(f"{'x':^{col_width}}")
            else:
                cells.append(f"{'v':^{col_width}}")
        
        print(row + " | ".join(cells))

    print("\nEmployee Stats:")
    print(f"{'Name':<10} | {'Worked':<8} | {'Paid Off':<8} | {'Total':<8} | {'Target':<8} | {'Diff':<8} | {'Opens':<5} | {'Closes':<5} | {'Middle':<5}")
    print("-" * 100)
    for i, emp in enumerate(employees):
        worked = work_hours[i]
        paid = paid_hours_map[i]
        total = worked + paid
        target = emp['hours_fund']
        diff = total - target
        
        # Calculate Opens/Closes from schedule
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
                
        print(f"{emp['name']:<10} | {worked:<8.1f} | {paid:<8.1f} | {total:<8.1f} | {target:<8} | {diff:<+8.1f} | {opens:<5} | {closes:<5} | {middle:<5}")

if __name__ == "__main__":
    solve_schedule('data_scalable.json')
