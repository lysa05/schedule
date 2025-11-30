import json
import random
import os

def generate_scenario(size, filename):
    print(f"Generating {size} scenario -> {filename}")
    
    # Configuration
    year = 2025
    month = 12
    
    # Roles distribution
    if size == 'small':
        num_employees = 5
        roles = ['manager', 'deputy', 'assistant', 'assistant', 'assistant']
        ftes = [1.0, 1.0, 0.75, 0.5, 0.5] # Removed 0.25
    elif size == 'medium':
        num_employees = 15
        roles = ['manager', 'deputy', 'deputy'] + ['supervisor']*2 + ['assistant']*10
        ftes = [1.0]*5 + [0.75]*5 + [0.5]*5 # Removed 0.25s, added to 0.5
    else: # large
        num_employees = 25
        roles = ['manager', 'deputy', 'deputy'] + ['supervisor']*4 + ['assistant']*18
        ftes = [1.0]*8 + [0.75]*8 + [0.5]*9 # Removed 0.25s, added to 0.5
        
    # Employees
    employees = []
    names = [
        "Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy",
        "Karl", "Liam", "Mia", "Noah", "Olivia", "Peggy", "Quinn", "Rupert", "Sybil", "Ted",
        "Ursula", "Victor", "Walter", "Xena", "Yvonne", "Zelda"
    ]
    
    for i in range(num_employees):
        name = names[i % len(names)]
        if i >= len(names): name += f"_{i}"
        
        # Random constraints
        unavailable = []
        # Increased probability (0.3 -> 0.5) and max days (3 -> 5) for realism
        if random.random() < 0.5: 
            unavailable = random.sample(range(1, 32), k=random.randint(2, 5))
            
        vacation = []
        if random.random() < 0.2: # 20% chance of vacation
            start = random.randint(1, 20)
            length = random.randint(2, 5)
            vacation = list(range(start, start + length))
            
        employees.append({
            "name": name,
            "role": roles[i],
            "contract_type": ftes[i],
            "unavailable_days": unavailable,
            "vacation_days": vacation
        })
        
    # Special Days (December Logic)
    special_days = {
        "24": {"type": "holiday_short_paid", "open": "08:30", "close": "14:00"},
        "25": {"type": "holiday_closed"},
        "26": {"type": "holiday_closed"},
        "31": {"type": "holiday_short_unpaid", "open": "08:30", "close": "16:00"}
    }
    
    # Busy weekends (Fri, Sat, Sun)
    # In Dec 2025:
    # Fri: 5, 12, 19
    # Sat: 6, 13, 20, 27
    # Sun: 7, 14, 21, 28
    # Let's mark some as busy manually or rely on config 'busy_weekends'
    
    data = {
        "year": year,
        "month": month,
        "full_time_hours": 184, # Updated to 184
        "config": {
            "busy_weekends": True,
            "manager_roles": ["manager", "deputy"],
            "min_openers": 1 if size == 'small' else 2,
            "min_closers": 1 if size == 'small' else 2,
            "default_open_time": "08:30", # Updated to 08:30
            "default_close_time": "21:00"
        },
        "employees": employees,
        "special_days": special_days,
        "closed_holidays": [25, 26], # Explicitly listed for backward compat, though special_days handles it too
        "weights": {
            "work_hours": 1000,
            "day_shape": 100,
            "shift_cost": 10,
            "open_close_fairness": 5,
            "clopen": 50
        }
    }
    
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    # Determine the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Generate files in the same directory as the script
    generate_scenario('small', os.path.join(script_dir, 'data_small.json'))
    generate_scenario('medium', os.path.join(script_dir, 'data_medium.json'))
    generate_scenario('large', os.path.join(script_dir, 'data_large.json'))
