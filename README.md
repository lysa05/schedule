# Smart Shift Scheduler

[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](https://lysa05.github.io/schedule/)

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

- `app/scheduler.py`: The main logic script using OR-Tools.
- `app/main.py`: FastAPI application entry point.
- `tests/`: Stress testing suite and data generators.
- `data_scalable.json`: Configuration file example.

## ⚙️ Configuration

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
        "min_closers": 1,           // Minimum people ending at Close
        "enable_clopen_ban": true   // Prevent Close -> Open shifts
    }
}
```

### Holidays & Special Days
```json
{
    "closed_holidays": [25, 26],    // Shop Closed (Paid)
    "special_days": {
        "24": {"type": "holiday_short_paid", "open": "08:30", "close": "14:00"},
        "31": {"type": "holiday_short_unpaid", "open": "08:30", "close": "16:00"}
    }
}
```

## 🏃 How to Run

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
2.  **Run Application**:
    ```bash
    python app/main.py
    ```

## 🧪 Stress Testing & QA

The project includes a comprehensive stress testing suite to ensure model quality and performance across different store sizes.

### Features
- **Realistic Data Generation**: Creates complex scenarios (Small/Medium/Large stores) with December holidays and varied employee constraints.
- **"Human" Metrics**: Evaluates schedules not just for technical correctness but for fairness, open/close balance, and "clopen" avoidance.
- **Performance Tuning**:
    - **Gap Limit**: Solver stops when within 5% of optimal (`relative_gap_limit = 0.05`).
    - **Optional Clopen Ban**: Can be toggled for performance (`enable_clopen_ban`).

### Running Tests
```bash
cd tests
python3 generate_stress_data.py  # Generate scenarios
python3 run_stress_tests.py      # Run solver and analyze results
```
