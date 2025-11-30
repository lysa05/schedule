import sys
import os
import json

# Add app directory to path so we can import scheduler
sys.path.append(os.path.join(os.getcwd(), 'app'))

from scheduler import generate_shift_templates, get_paid_hours, parse_time

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
