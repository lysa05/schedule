import json
import random
import copy
import calendar

def load_data(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    # Post-process employees to calculate hours_fund
    full_time = data.get('full_time_hours', 184)
    for emp in data['employees']:
        if 'hours_fund' not in emp:
            ctype = emp.get('contract_type', 1.0)
            emp['hours_fund'] = full_time * ctype
            
    return data

def is_available(employee, day, closed_holidays):
    if day in employee.get('unavailable_days', []):
        return False
    if day in closed_holidays:
        return False
    if day in employee.get('vacation_days', []):
        return False
    return True

def get_paid_hours(employee, closed_holidays):
    ctype = employee.get('contract_type', 1.0)
    
    if ctype >= 1.0:
        credit_per_day = 8.0
    elif ctype >= 0.75:
        credit_per_day = 6.0
    else:
        credit_per_day = 4.0
    
    paid_hours = 0
    paid_days = set()
    
    for h in closed_holidays:
        paid_hours += credit_per_day
        paid_days.add(h)
        
    for v in employee.get('vacation_days', []):
        if v not in paid_days:
            paid_hours += credit_per_day
            paid_days.add(v)
            
    return paid_hours, paid_days, credit_per_day

def parse_time(t_str):
    h, m = map(int, t_str.split(':'))
    return h + m / 60.0

def generate_shift_length(target_work_hours, current_work_hours, shift_type, min_limit=None, max_limit=None):
    if shift_type == 'OPEN':
        min_h, max_h = 6.0, 10.5
    elif shift_type == 'CLOSE':
        min_h, max_h = 8.0, 11.0
    else: # FLEX
        min_h, max_h = 6.0, 11.0
        
    if min_limit is not None: min_h = min_limit
    if max_limit is not None: max_h = max_limit
    
    if min_h > max_h: min_h = max_h
    
    if current_work_hours < target_work_hours * 0.8:
        base = random.uniform(max_h - 2, max_h)
    elif current_work_hours > target_work_hours * 1.1:
        base = random.uniform(min_h, min_h + 2)
    else:
        base = random.uniform(min_h, max_h)
        
    hours = round(base * 2) / 2
    return max(min_h, min(max_h, hours))

def calculate_daily_staff_needs(employees, year, month, day, config):
    # Auto-staffing Logic
    if not config.get('auto_staffing', False):
        return config.get('default_staff_count', 4)
        
    # Improved Logic: Calculate based on Total Hours Fund
    total_fund = sum(e['hours_fund'] for e in employees)
    _, num_days = calendar.monthrange(year, month)
    
    # Average hours needed per day
    daily_hours_needed = total_fund / num_days
    
    # Assume average shift length of 8.0 hours
    avg_shift_len = 8.0
    
    base_staff = round(daily_hours_needed / avg_shift_len)
    req_staff = max(2, int(base_staff))
    
    # Weekend Logic
    # Only add extra staff if we have enough people (heuristic: need at least req_staff + 2 available to be safe)
    # But here we just calculate raw need. The availability check happens later.
    if config.get('busy_weekends', False):
        weekday = calendar.weekday(year, month, day) # 0=Mon, 6=Sun
        if weekday >= 4: # Fri, Sat, Sun
            req_staff += 1
            
    return req_staff

def calculate_shift_distribution(req_staff, config):
    min_openers = config.get('min_openers', 1)
    min_closers = config.get('min_closers', 1)
    
    # Logic:
    # 1. Flex only if req_staff >= 5
    # 2. Split remaining between Open/Close
    # 3. Bias towards Close (ceil)
    
    n_flex = 0
    if req_staff >= 5:
        n_flex = 1
        # If huge team, maybe more flex?
        if req_staff >= 8: n_flex = 2
        
    remaining = req_staff - n_flex
    
    # Split remaining
    # If remaining is 3 -> 1 Open, 2 Close
    # If remaining is 4 -> 2 Open, 2 Close
    
    import math
    n_close = math.ceil(remaining / 2)
    n_open = math.floor(remaining / 2)
    
    # Enforce minimums
    if n_open < min_openers:
        diff = min_openers - n_open
        n_open += diff
        n_close -= diff # Steal from close? Or reduce flex?
        # If n_close < min_closers now, we have a problem.
        # But usually min_openers=1, so n_open >= 1 is easy.
        
    if n_close < min_closers:
        diff = min_closers - n_close
        n_close += diff
        n_open -= diff
        
    # Re-balance if negative (shouldn't happen with normal inputs)
    if n_open < 0: n_open = 0
    if n_close < 0: n_close = 0
    
    # Recalculate flex to fill gaps
    current_total = n_open + n_close + n_flex
    if current_total < req_staff:
        n_flex += (req_staff - current_total)
    elif current_total > req_staff:
        # Reduce flex first
        diff = current_total - req_staff
        if n_flex >= diff:
            n_flex -= diff
        else:
            # Reduce open/close
            remaining_diff = diff - n_flex
            n_flex = 0
            # Reduce open first (since close is priority)
            n_open -= remaining_diff
            
    return n_open, n_close, n_flex

def generate_schedule(employees, year, month, closed_holidays, special_days, config):
    _, num_days = calendar.monthrange(year, month)
    
    schedule = {} 
    employee_work_hours = {i: 0.0 for i in range(len(employees))}
    consecutive_days = {i: 0 for i in range(len(employees))}
    
    employee_targets = {}
    employee_paid_info = {} 
    
    for i, emp in enumerate(employees):
        paid_h, paid_d, credit = get_paid_hours(emp, closed_holidays)
        employee_paid_info[i] = {'hours': paid_h, 'days': paid_d, 'credit': credit}
        employee_targets[i] = max(0, emp['hours_fund'] - paid_h)

    available_employees = {} 
    daily_requirements = {}
    
    for day in range(1, num_days + 1):
        available_employees[day] = [i for i, e in enumerate(employees) if is_available(e, day, closed_holidays)]
        
        if day in closed_holidays:
            continue
            
        # Determine staff count
        req_staff = calculate_daily_staff_needs(employees, year, month, day, config)
        
        # Override with special days
        if str(day) in special_days:
            req_staff = special_days[str(day)].get('staff', req_staff)
            
        # Cap at available employees
        if req_staff > len(available_employees[day]):
            req_staff = len(available_employees[day])
            
        daily_requirements[day] = req_staff
            
        if len(available_employees[day]) < req_staff:
             # This should theoretically not happen due to the cap above, 
             # unless available_employees is 0 and req_staff becomes 0 (which is handled by min=2 usually)
             # But if available is 0, we can't schedule.
             if req_staff > 0:
                return None, None, None, None, None

    for day in range(1, num_days + 1):
        if day in closed_holidays:
            continue
            
        daily_shifts = {}
        
        day_candidates = []
        for idx in available_employees[day]:
            if consecutive_days[idx] < 4:
                day_candidates.append(idx)
        
        # Fallback: If not enough candidates, allow those with 4 consecutive days (up to 5)
        if len(day_candidates) < req_staff:
             for idx in available_employees[day]:
                if consecutive_days[idx] == 4:
                    day_candidates.append(idx)
                    
        req_staff = daily_requirements[day]
        close_time = 21.0
        
        if str(day) in special_days:
            close_time = parse_time(special_days[str(day)].get('close', '21:00'))
            
        if len(day_candidates) < req_staff:
            # print(f"Failed on day {day}: Need {req_staff}, Candidates {len(day_candidates)} (Consecutive limit?)")
            return None, None, None, None, None
            
        # Weighted Selection: Prioritize those furthest from target
        # Sort key: (current / target) + random noise
        # Low ratio = Needs hours = Priority
        def sort_key(idx):
            target = employee_targets[idx]
            if target == 0: return 100 # Low priority if no target
            ratio = employee_work_hours[idx] / target
            return ratio + random.uniform(-0.1, 0.1)
            
        day_candidates.sort(key=sort_key, reverse=True) # Sort Descending because we pop() from end
        # pop() takes from end, so end should have lowest ratio (highest priority)
        # So sort Descending puts High Ratio at start, Low Ratio at end.
        # Correct.
        
        is_short_day = close_time <= 18.0
        
        if is_short_day:
            for _ in range(req_staff):
                if not day_candidates: break
                worker_idx = day_candidates.pop()
                start_time = 8.5
                end_time = close_time
                hours = end_time - start_time
                
                daily_shifts[worker_idx] = {"start": start_time, "end": end_time, "type": "FIXED", "fixed": True}
                employee_work_hours[worker_idx] += hours
                consecutive_days[worker_idx] += 1
        else:
            calc_openers, calc_closers, calc_flex = calculate_shift_distribution(req_staff, config)
                
            assigned_count = 0
            
            # 1. Assign Openers
            for _ in range(calc_openers):
                if not day_candidates: break
                opener_idx = day_candidates.pop()
                
                op_max_h = min(10.5, close_time - 8.5)
                op_min_h = 6.0
                if op_max_h < op_min_h: op_min_h = op_max_h
                
                opener_h = generate_shift_length(employee_targets[opener_idx], employee_work_hours[opener_idx], 'OPEN', min_limit=op_min_h, max_limit=op_max_h)
                
                start_time = 8.5
                end_time = start_time + opener_h
                
                daily_shifts[opener_idx] = {"start": start_time, "end": end_time, "type": "OPEN", "fixed": False}
                employee_work_hours[opener_idx] += opener_h
                consecutive_days[opener_idx] += 1
                assigned_count += 1
                
            # 2. Assign Closers
            for _ in range(calc_closers):
                if not day_candidates: break
                closer_idx = day_candidates.pop()
                
                cl_max_h = min(11.0, close_time - 8.5)
                cl_min_h = 8.0
                if close_time - 8.5 < cl_min_h:
                    cl_min_h = max(4.0, close_time - 8.5)
                
                closer_h = generate_shift_length(employee_targets[closer_idx], employee_work_hours[closer_idx], 'CLOSE', min_limit=cl_min_h, max_limit=cl_max_h)
                
                end_time_close = close_time
                start_time_close = end_time_close - closer_h
                
                daily_shifts[closer_idx] = {"start": start_time_close, "end": end_time_close, "type": "CLOSE", "fixed": False}
                employee_work_hours[closer_idx] += closer_h
                consecutive_days[closer_idx] += 1
                assigned_count += 1
                
            # 3. Assign Flex
            # remaining_needed = req_staff - assigned_count # Should match calc_flex
            for _ in range(calc_flex):
                if not day_candidates: break
                mid_idx = day_candidates.pop()
                
                mid_max_h = min(11.0, close_time - 8.5)
                mid_h = generate_shift_length(employee_targets[mid_idx], employee_work_hours[mid_idx], 'FLEX', max_limit=mid_max_h)
                
                earliest_start = 10.0
                latest_start = close_time - mid_h
                if latest_start < earliest_start: latest_start = earliest_start
                
                mid_start = earliest_start + random.uniform(0, max(0, latest_start - earliest_start))
                mid_start = round(mid_start * 2) / 2
                mid_end = mid_start + mid_h
                
                if mid_end > close_time:
                    mid_end = close_time
                    mid_h = mid_end - mid_start
                
                daily_shifts[mid_idx] = {"start": mid_start, "end": mid_end, "type": "FLEX", "fixed": False}
                employee_work_hours[mid_idx] += mid_h
                consecutive_days[mid_idx] += 1
        
        for i in range(len(employees)):
            if i not in daily_shifts:
                consecutive_days[i] = 0
                
        schedule[day] = daily_shifts

    return schedule, employee_work_hours, consecutive_days, employee_targets, employee_paid_info

def optimize_hours(schedule, employee_work_hours, employee_targets, employees, num_days, special_days):
    improved = True
    while improved:
        improved = False
        for i, emp in enumerate(employees):
            target = employee_targets[i]
            diff = employee_work_hours[i] - target
            
            if abs(diff) < 0.5:
                continue
                
            if diff > 0:
                for day in range(1, num_days + 1):
                    if i in schedule.get(day, {}):
                        shift = schedule[day][i]
                        if shift.get('fixed', False): continue
                        
                        close_time = 21.0
                        if str(day) in special_days:
                            close_time = parse_time(special_days[str(day)].get('close', '21:00'))
                            
                        current_len = shift['end'] - shift['start']
                        new_len = current_len - 0.5
                        
                        valid = False
                        if shift['type'] == 'OPEN':
                            if new_len >= 6.0:
                                shift['end'] -= 0.5
                                valid = True
                        elif shift['type'] == 'CLOSE':
                            min_len = 8.0
                            if close_time - 8.5 < 8.0: min_len = 4.0
                            if new_len >= min_len:
                                shift['start'] += 0.5
                                valid = True
                        else: # FLEX
                            if new_len >= 6.0:
                                shift['end'] -= 0.5
                                valid = True
                                
                        if valid:
                            employee_work_hours[i] -= 0.5
                            improved = True
                            diff -= 0.5
                            if diff <= 0: break
                            
            elif diff < 0:
                for day in range(1, num_days + 1):
                    if i in schedule.get(day, {}):
                        shift = schedule[day][i]
                        if shift.get('fixed', False): continue
                        
                        close_time = 21.0
                        if str(day) in special_days:
                            close_time = parse_time(special_days[str(day)].get('close', '21:00'))
                            
                        current_len = shift['end'] - shift['start']
                        new_len = current_len + 0.5
                        
                        valid = False
                        if shift['type'] == 'OPEN':
                            if new_len <= 10.5 and (shift['end'] + 0.5) <= min(19.0, close_time):
                                shift['end'] += 0.5
                                valid = True
                        elif shift['type'] == 'CLOSE':
                            if new_len <= 11.0 and (shift['start'] - 0.5) <= 13.0:
                                if (shift['start'] - 0.5) >= 8.5:
                                    shift['start'] -= 0.5
                                    valid = True
                        else: # FLEX
                            if new_len <= 11.0 and (shift['end'] + 0.5) <= close_time:
                                shift['end'] += 0.5
                                valid = True
                                
                        if valid:
                            employee_work_hours[i] += 0.5
                            improved = True
                            diff += 0.5
                            if diff >= 0: break
                            
    return schedule, employee_work_hours

def calculate_score(employees, employee_work_hours, employee_targets):
    score = 0
    for i, emp in enumerate(employees):
        diff = abs(employee_targets[i] - employee_work_hours[i])
        if employee_work_hours[i] < employee_targets[i]:
            score += diff * 2
        else:
            score += diff
    return score

def solve_shift_scheduling(data_file, iterations=100000):
    data = load_data(data_file)
    employees = data['employees']
    year = data.get('year', 2025)
    month = data.get('month', 1)
    _, num_days = calendar.monthrange(year, month)
    
    config = data.get('config', {})
    closed_holidays = data.get('closed_holidays', [])
    open_holidays = data.get('open_holidays', [])
    special_days = data.get('special_days', {})
    
    best_schedule = None
    best_work_hours = None
    best_targets = None
    best_paid_info = None
    best_score = float('inf')
    
    print(f"Searching for schedule ({iterations} iterations)...")
    print(f"Year: {year}, Month: {month}, Days: {num_days}")
    print(f"Auto-staffing: {config.get('auto_staffing')}, Busy Weekends: {config.get('busy_weekends')}")
    
    for _ in range(iterations):
        schedule, work_hours, _, targets, paid_info = generate_schedule(employees, year, month, closed_holidays, special_days, config)
        if schedule:
            schedule, work_hours = optimize_hours(schedule, work_hours, targets, employees, num_days, special_days)
            
            score = calculate_score(employees, work_hours, targets)
            if score < best_score:
                best_score = score
                best_schedule = schedule
                best_work_hours = work_hours
                best_targets = targets
                best_paid_info = paid_info
                
                if score < len(employees) * 1:
                    break
    
    if best_schedule:
        print(f"Solution found! Score: {best_score:.1f}")
        print_matrix(best_schedule, employees, year, month, num_days, best_work_hours, best_paid_info, closed_holidays, open_holidays, special_days)
    else:
        print("No valid schedule found.")

def print_matrix(schedule, employees, year, month, num_days, work_hours, paid_info, closed_holidays, open_holidays, special_days):
    names = [e['name'] for e in employees]
    col_width = 15
    header = f"{'Day':<8} | " + " | ".join([f"{n:^{col_width}}" for n in names])
    print("\n" + header)
    print("-" * len(header))
    
    def fmt(t):
        h = int(t)
        m = int((t - h) * 60)
        return f"{h:02d}:{m:02d}"
    
    days_of_week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    for day in range(1, num_days + 1):
        weekday = calendar.weekday(year, month, day)
        day_str = f"{day} {days_of_week[weekday]}"
        
        day_label = day_str
        if day in open_holidays:
            day_label += "*"
        if str(day) in special_days:
            day_label += "!"
            
        row = f"{day_label:<8} | "
        day_shifts = schedule.get(day, {})
        
        cells = []
        for i, emp in enumerate(employees):
            if day in paid_info[i]['days']:
                credit = paid_info[i]['credit']
                label = "HOL" if day in closed_holidays else "VAC"
                cells.append(f"{f'{label} ({int(credit)}h)':^{col_width}}")
            elif i in day_shifts:
                s = day_shifts[i]
                time_range = f"{fmt(s['start'])}-{fmt(s['end'])}"
                cells.append(f"{time_range:^{col_width}}")
            elif not is_available(emp, day, closed_holidays):
                cells.append(f"{'x':^{col_width}}")
            else:
                cells.append(f"{'v':^{col_width}}")
        
        print(row + " | ".join(cells))
        
    if open_holidays:
        print("\n* = Open Holiday")
    if special_days:
        print("! = Special Day (Custom hours/staff)")

    print("\nEmployee Stats:")
    print(f"{'Name':<10} | {'Worked':<8} | {'Paid Off':<8} | {'Total':<8} | {'Target':<8} | {'Diff':<8}")
    print("-" * 65)
    for i, emp in enumerate(employees):
        worked = work_hours[i]
        paid = paid_info[i]['hours']
        total = worked + paid
        target = emp['hours_fund']
        diff = total - target
        print(f"{emp['name']:<10} | {worked:<8.1f} | {paid:<8.1f} | {total:<8.1f} | {target:<8} | {diff:<+8.1f}")

if __name__ == "__main__":
    solve_shift_scheduling('data_scalable.json')
