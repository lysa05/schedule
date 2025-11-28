import json
import random
import copy

def load_data(filename):
    with open(filename, 'r') as f:
        return json.load(f)

def is_available(employee, day, closed_holidays):
    if day in employee.get('unavailable_days', []):
        return False
    if day in closed_holidays:
        return False
    if day in employee.get('vacation_days', []):
        return False
    return True

def get_paid_hours(employee, closed_holidays):
    is_full_time = employee['hours_fund'] > 100
    credit_per_day = 8.0 if is_full_time else 4.0
    
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
    else:
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

def generate_schedule(employees, num_days, closed_holidays, special_days):
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
    for day in range(1, num_days + 1):
        available_employees[day] = [i for i, e in enumerate(employees) if is_available(e, day, closed_holidays)]
        
        if day in closed_holidays:
            continue
            
        req_staff = 2
        if str(day) in special_days:
            req_staff = special_days[str(day)].get('staff', 2)
            
        if len(available_employees[day]) < req_staff:
            return None, None, None, None, None

    for day in range(1, num_days + 1):
        if day in closed_holidays:
            continue
            
        daily_shifts = {}
        
        day_candidates = []
        for idx in available_employees[day]:
            if consecutive_days[idx] < 4:
                day_candidates.append(idx)
        
        is_special = str(day) in special_days
        req_staff = 2
        close_time = 21.0
        
        if is_special:
            sd = special_days[str(day)]
            req_staff = sd.get('staff', 2)
            close_time = parse_time(sd.get('close', '21:00'))
            
        if len(day_candidates) < req_staff:
            return None, None, None, None, None
            
        random.shuffle(day_candidates)
        
        # Check for Short Special Day (Close <= 18:00)
        # If so, force full shifts for everyone
        is_short_day = close_time <= 18.0
        
        if is_short_day:
            # Assign req_staff people to work Open-Close
            for _ in range(req_staff):
                if not day_candidates: break
                worker_idx = day_candidates.pop()
                start_time = 8.5
                end_time = close_time
                hours = end_time - start_time
                
                daily_shifts[worker_idx] = {"start": start_time, "end": end_time, "type": "FIXED", "fixed": True}
                employee_work_hours[worker_idx] += hours
                consecutive_days[worker_idx] += 1
        
        elif req_staff == 1:
            # Special case: 1 person, Open to Close (also treated as fixed usually)
            worker_idx = day_candidates.pop()
            start_time = 8.5
            end_time = close_time
            hours = end_time - start_time
            
            daily_shifts[worker_idx] = {"start": start_time, "end": end_time, "type": "SOLO", "fixed": True}
            employee_work_hours[worker_idx] += hours
            consecutive_days[worker_idx] += 1
            
        else:
            # Standard 2+ people logic
            
            # Opener
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
            
            # Closer
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
            
            # Optional MID
            if day_candidates and close_time > 16.0:
                candidates = []
                for idx in day_candidates:
                    if employee_work_hours[idx] < employee_targets[idx] * (day / num_days):
                         candidates.append(idx)
                
                if candidates or random.random() > 0.7:
                    mid_idx = candidates[0] if candidates else random.choice(day_candidates)
                    
                    mid_max_h = min(11.0, close_time - 8.5)
                    mid_h = generate_shift_length(employee_targets[mid_idx], employee_work_hours[mid_idx], 'MID', max_limit=mid_max_h)
                    
                    latest_start = close_time - mid_h
                    earliest_start = 10.0
                    if latest_start < earliest_start: latest_start = earliest_start
                    
                    mid_start = earliest_start + random.uniform(0, max(0, latest_start - earliest_start))
                    mid_start = round(mid_start * 2) / 2
                    mid_end = mid_start + mid_h
                    
                    if mid_end > close_time:
                        mid_end = close_time
                        mid_h = mid_end - mid_start
                    
                    daily_shifts[mid_idx] = {"start": mid_start, "end": mid_end, "type": "MID", "fixed": False}
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
                        
                        # Skip fixed shifts
                        if shift.get('fixed', False):
                            continue
                        
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
                        elif shift['type'] == 'MID':
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
                        
                        # Skip fixed shifts
                        if shift.get('fixed', False):
                            continue
                        
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
                        elif shift['type'] == 'MID':
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
    num_days = data['month_days']
    closed_holidays = data.get('closed_holidays', [])
    open_holidays = data.get('open_holidays', [])
    special_days = data.get('special_days', {})
    
    best_schedule = None
    best_work_hours = None
    best_targets = None
    best_paid_info = None
    best_score = float('inf')
    
    print(f"Searching for schedule ({iterations} iterations)...")
    
    for _ in range(iterations):
        schedule, work_hours, _, targets, paid_info = generate_schedule(employees, num_days, closed_holidays, special_days)
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
        print_matrix(best_schedule, employees, num_days, best_work_hours, best_paid_info, closed_holidays, open_holidays, special_days)
    else:
        print("No valid schedule found.")

def print_matrix(schedule, employees, num_days, work_hours, paid_info, closed_holidays, open_holidays, special_days):
    names = [e['name'] for e in employees]
    col_width = 15
    header = f"{'Day':<5} | " + " | ".join([f"{n:^{col_width}}" for n in names])
    print("\n" + header)
    print("-" * len(header))
    
    def fmt(t):
        h = int(t)
        m = int((t - h) * 60)
        return f"{h:02d}:{m:02d}"
    
    for day in range(1, num_days + 1):
        day_label = str(day)
        if day in open_holidays:
            day_label += "*"
        if str(day) in special_days:
            day_label += "!"
            
        row = f"{day_label:<5} | "
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
    solve_shift_scheduling('data.json')
