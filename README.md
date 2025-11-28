# Smart Shift Scheduler

A Python-based automated shift scheduling tool designed for retail stores. It handles complex constraints, fair workload balancing, and smart staffing calculations.

## 🚀 Features

### 🧠 Smart Automation
- **Auto-Staffing**: Automatically calculates daily staffing needs based on your team's total hours fund.
- **Calendar Integration**: Simply provide the Year and Month; the system handles weekends and dates.
- **Traffic Logic**: Option to automatically increase staff on busy weekends (`Fri`, `Sat`, `Sun`).

### ⚖️ Workload & Fairness
- **Balanced Hours**: Prioritizes employees who are furthest from their monthly target hours.
- **Contract Support**: Native support for different contract types (1.0, 0.75, 0.5 FTE) with automatic hours fund and holiday pay calculation.
- **Fair Shifts**: Prioritizes "Open" and "Close" shifts to avoid inconvenient middle shifts.
- **Special Days**: Handles custom closing times (e.g., Dec 24, Dec 31) and ensures fair full-day shifts on short days.

### 🛠️ Constraints
- **Shift Rules**:
    - **Opener**: Starts 08:30, Max End 19:00.
    - **Closer**: Ends 21:00, Max Start 13:00.
    - **Flex**: Only used when staff count >= 5.
- **Consecutive Days**: Max 4 days in a row (with intelligent fallback to 5 if absolutely necessary).
- **Availability**: Respects individual requests for days off.
- **Holidays**:
    - **Closed Holidays**: Shop closed, paid credit given.
    - **Open Holidays**: Shop open, treated as normal work day.
    - **Vacations**: Paid credit given.

## 📂 File Structure

- `scheduler_scalable.py`: The main logic script.
- `data_scalable.json`: Configuration file for employees, store settings, and holidays.
- `scheduler.py` / `data.json`: Legacy versions (for smaller/simpler use cases).

## ⚙️ Configuration (`data_scalable.json`)

### Global Settings
```json
{
    "year": 2025,
    "month": 12,
    "full_time_hours": 184,
    "config": {
        "auto_staffing": true,      // Calculate staff needs automatically
        "busy_weekends": true,      // Add +1 staff on Fri/Sat/Sun
        "min_openers": 1,           // Minimum people starting at Open
        "min_closers": 1            // Minimum people ending at Close
    }
}
```

### Holidays & Special Days
```json
{
    "closed_holidays": [25, 26],    // Shop Closed (Paid)
    "open_holidays": [24],          // Shop Open (Normal)
    "special_days": {
        "24": {"close": "12:00", "staff": 2},
        "31": {"close": "17:00", "staff": 3}
    }
}
```

### Employees
```json
{
    "name": "Kuba",
    "contract_type": 1.0,           // 1.0 = Full Time, 0.5 = Half Time, etc.
    "unavailable_days": [6, 7],     // Requested days off
    "vacation_days": []             // Paid vacation days
}
```

## 🏃 How to Run

1.  **Install Python**: Ensure you have Python installed.
2.  **Configure**: Edit `data_scalable.json` with your current month's data.
3.  **Run**:
    ```bash
    python scheduler_scalable.py
    ```
4.  **Output**: The script will print the optimized schedule and employee statistics to the console.

## 📊 Example Output

```text
Day      |      Kuba       |     Andrii      | ...
--------------------------------------------------
1 Mon    |   08:30-18:00   |   13:00-21:00   | ...
...
24 Wed*! |   08:30-12:00   |        v        | ...
25 Thu   |    HOL (8h)     |    HOL (8h)     | ...
```
