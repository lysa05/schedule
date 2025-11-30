import math
import json

# --- COPIED FUNCTIONS FROM scheduler.py (to avoid OR-Tools import crash) ---

def parse_time(t_str):
    h, m = map(int, t_str.split(':'))
    return h + m / 60.0

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

# --- TEST LOGIC ---

def test_flex_bias():
    print("\n=== Testing FLEX Shift Bias & Strict CLOSE ===")
    
    # Mock data
    day = 1
    special_days = {}
    default_open = parse_time("08:30")
    default_close = parse_time("21:00")
    
    templates = generate_shift_templates(day, special_days, default_open, default_close)
    
    flex_shifts = [t for t in templates if t['type'] == 'FLEX']
    close_shifts = [t for t in templates if t['type'] == 'CLOSE']
    
    print(f"Generated {len(templates)} templates.")
    print(f"FLEX shifts: {len(flex_shifts)}")
    print(f"CLOSE shifts: {len(close_shifts)}")
    
    # 1. Verify NO FLEX shift ends at close_time
    invalid_flex = [t for t in flex_shifts if t['end'] == default_close]
    if invalid_flex:
        print("FAIL: Found FLEX shifts ending at close time!")
        for t in invalid_flex:
            print(f"  - {t}")
    else:
        print("PASS: No FLEX shifts end at close time.")
        
    # 2. Verify CLOSE shifts end at close_time
    invalid_close = [t for t in close_shifts if t['end'] != default_close]
    if invalid_close:
        print("FAIL: Found CLOSE shifts NOT ending at close time!")
    else:
        print("PASS: All CLOSE shifts end at close time.")
        
    # 3. Verify Bias (10:00 - 19:00)
    # Compare cost of 10-19 shift vs 11-20 shift (same duration)
    # 10-19: duration 9.0. Start 10, End 19. Ideal.
    # 11-20: duration 9.0. Start 11 (dev 1), End 20 (dev 1). Penalty should be higher.
    
    t_ideal = next((t for t in flex_shifts if t['start'] == 10.0 and t['end'] == 19.0), None)
    t_deviant = next((t for t in flex_shifts if t['start'] == 11.0 and t['end'] == 20.0), None)
    
    if t_ideal and t_deviant:
        print(f"Cost of 10:00-19:00 (Ideal): {t_ideal['cost']}")
        print(f"Cost of 11:00-20:00 (Deviant): {t_deviant['cost']}")
        
        if t_deviant['cost'] > t_ideal['cost']:
            print("PASS: Deviant shift has higher cost.")
        else:
            print("FAIL: Deviant shift does not have higher cost.")
    else:
        print("WARNING: Could not find specific shifts to compare costs.")

def test_holiday_logic():
    print("\n=== Testing Holiday Logic ===")
    
    # Mock Data
    employee = {
        "contract_type": 1.0, # 8h credit
        "vacation_days": [5]
    }
    closed_holidays = [1] # Day 1 is closed holiday
    special_days = {
        "2": {"type": "holiday_short_paid"},   # Day 2 is short paid
        "3": {"type": "holiday_short_unpaid"}, # Day 3 is short unpaid
        "4": {"type": "normal"}                # Day 4 is normal
    }
    
    # Test
    paid_hours, paid_days, credit = get_paid_hours(employee, closed_holidays, special_days)
    
    print(f"Contract: 1.0 (Credit {credit}h)")
    print(f"Closed Holidays: {closed_holidays}")
    print(f"Special Days: {json.dumps(special_days, indent=2)}")
    print(f"Vacation Days: {employee['vacation_days']}")
    
    print(f"\nCalculated Paid Hours: {paid_hours}")
    print(f"Paid Days: {paid_days}")
    
    # Verification
    # Day 1 (Closed): Should be paid.
    # Day 2 (Short Paid): Should be paid.
    # Day 3 (Short Unpaid): Should NOT be paid.
    # Day 4 (Normal): Should NOT be paid.
    # Day 5 (Vacation): Should be paid.
    
    expected_days = {1, 2, 5}
    if paid_days == expected_days:
        print("PASS: Paid days match expected set {1, 2, 5}.")
    else:
        print(f"FAIL: Expected {expected_days}, got {paid_days}")
        
    expected_hours = len(expected_days) * 8.0
    if paid_hours == expected_hours:
        print(f"PASS: Paid hours match expected {expected_hours}.")
    else:
        print(f"FAIL: Expected {expected_hours}, got {paid_hours}")

if __name__ == "__main__":
    test_flex_bias()
    test_holiday_logic()
