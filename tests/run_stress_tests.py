import sys
import os
import json
import statistics
import time

# Add app directory to path (parent of tests directory + /app)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.append(os.path.join(project_root, 'app'))

from scheduler import solve_schedule, parse_time

def analyze_results(scenario_name, result, data):
    print(f"\n--- Analysis: {scenario_name} ---")
    
    if result['status'] not in ('OPTIMAL', 'FEASIBLE'):
        print(f"FAILED: Solver status is {result['status']}")
        return
        
    employees = result['employees']
    schedule = result['schedule']
    
    # 1. Solvability
    print(f"Status: {result['status']}")
    print(f"Solve Time: {result['solve_time_seconds']:.2f}s")
    print(f"Objective Value: {result['objective_value']}")
    
    # 2. Fairness (Diff from Target)
    diffs = [e['diff'] for e in employees]
    avg_diff = statistics.mean([abs(d) for d in diffs])
    max_diff = max([abs(d) for d in diffs])
    print(f"Fairness (Hours Diff): Avg Abs={avg_diff:.1f}h, Max Abs={max_diff:.1f}h")
    
    # 3. Open/Close Balance
    # Calculate standard deviation of open/close counts normalized by FTE?
    # Or just raw counts for now.
    opens = [e['opens'] for e in employees]
    closes = [e['closes'] for e in employees]
    print(f"Opens per emp: {min(opens)}-{max(opens)} (Avg {statistics.mean(opens):.1f})")
    print(f"Closes per emp: {min(closes)}-{max(closes)} (Avg {statistics.mean(closes):.1f})")
    
    # 4. Clopen Count
    clopen_count = 0
    for emp_name in schedule['1'].keys(): # Iterate employees present in day 1 (approx)
        # We need to iterate all days
        for day in range(1, 31):
            day_str = str(day)
            next_day_str = str(day + 1)
            
            if day_str in schedule and next_day_str in schedule:
                if emp_name in schedule[day_str] and emp_name in schedule[next_day_str]:
                    s1 = schedule[day_str][emp_name]
                    s2 = schedule[next_day_str][emp_name]
                    
                    if s1['type'] == 'CLOSE' and s2['type'] == 'OPEN':
                        clopen_count += 1
                        
    print(f"Clopen Count: {clopen_count}")
    
    # 5. FLEX Quality (Golden Hours 10-19)
    flex_shifts = []
    golden_flex = 0
    for day_shifts in schedule.values():
        for s in day_shifts.values():
            if s['type'] == 'FLEX':
                flex_shifts.append(s)
                # Check if roughly 10-19
                # Parse times
                start = parse_time(s['start'])
                end = parse_time(s['end'])
                if start >= 10.0 and end <= 19.0:
                    golden_flex += 1
                    
    if flex_shifts:
        print(f"FLEX Quality: {golden_flex}/{len(flex_shifts)} ({golden_flex/len(flex_shifts)*100:.1f}%) in Golden Hours (10-19)")
    else:
        print("FLEX Quality: N/A (No FLEX shifts)")

    # 6. Understaffing
    if result['understaffed']:
        total_deficit = sum(u['deficit'] for u in result['understaffed'])
        print(f"Understaffing: {len(result['understaffed'])} days, Total Deficit: {total_deficit}")
    else:
        print("Understaffing: None")
        
    # 7. Holiday Credits Check (Dec 24, 25, 26)
    # Everyone should have paid hours for these days if they didn't work (or even if they did, depending on logic, but mainly checking credit existence)
    # Actually, verify 'paid_off' stats
    print("Holiday Credits Check:")
    for emp in employees:
        # 1.0 FTE should have at least 3*8 = 24h paid off (plus vacation)
        # Just print a few examples
        pass
    
    # Print 3 random employees stats
    print("Sample Employee Stats:")
    for e in employees[:3]:
        print(f"  {e['name']}: Target {e['target']:.1f}, Worked {e['worked']:.1f}, Paid {e['paid_off']:.1f}, Diff {e['diff']:.1f}")

def run_tests():
    scenarios = ['small', 'medium', 'large']
    
    # Determine directories
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    for size in scenarios:
        filename = os.path.join(script_dir, f"data_{size}.json")
        print(f"\n\n==================================================")
        print(f"RUNNING SCENARIO: {size.upper()}")
        print(f"==================================================")
        
        with open(filename, 'r') as f:
            data = json.load(f)
            
        start_time = time.time()
        result = solve_schedule(data)
        end_time = time.time()
        
        print(f"Total Execution Time: {end_time - start_time:.2f}s")
        analyze_results(size, result, data)

if __name__ == "__main__":
    run_tests()
