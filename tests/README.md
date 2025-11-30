# Model Stress Testing & QA

This directory contains scripts to stress test the scheduler model with realistic scenarios.

## 1. Generate Data
Run the generator to create `data_small.json`, `data_medium.json`, and `data_large.json`. These scenarios simulate a complex December month with holidays.

```bash
python3 generate_stress_data.py
```

## 2. Run Tests
Run the test runner to execute the solver on the generated data and calculate quality metrics.

```bash
python3 run_stress_tests.py
```

## Metrics Evaluated
- **Solvability**: Status and Time.
- **Fairness**: Deviation of hours from target.
- **Open/Close Balance**: Distribution of shifts.
- **Clopen Count**: Should be 0.
- **FLEX Quality**: Percentage of FLEX shifts in "Golden Hours" (10:00-19:00).
- **Understaffing**: Deficit hours.
- **Holiday Credits**: Verification of paid hours.
