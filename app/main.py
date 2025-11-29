from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from . import scheduler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now (simplifies GitHub Pages deployment)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SpecialDayInput(BaseModel):
    day: int
    type: str  # "normal", "holiday_open", "holiday_closed"
    busy: bool

class EmployeeInput(BaseModel):
    id: str
    name: str
    role: str
    contract: str
    targetHours: float
    unavailableDays: List[int]
    vacationDays: List[int]

class SolveRequest(BaseModel):
    month: int
    year: int
    fulltimeHours: float
    employees: List[EmployeeInput]
    specialDays: List[SpecialDayInput]
    requireManagerMondays: bool

def transform_request(req: SolveRequest) -> Dict[str, Any]:
    # Convert new frontend payload to old backend dict structure
    
    # 1. Employees
    employees = []
    for e in req.employees:
        # Map contract string to float
        contract_map = {
            "fulltime": 1.0,
            "0.75": 0.75,
            "0.5": 0.5,
            "student": 0.3, # Approx
            "custom": 1.0 # Fallback, relies on targetHours
        }
        ctype = contract_map.get(e.contract, 1.0)
        
        employees.append({
            "name": e.name,
            "role": e.role,
            "contract_type": ctype,
            "hours_fund": e.targetHours,
            "unavailable_days": e.unavailableDays,
            "vacation_days": e.vacationDays
        })
        
    # 2. Special Days
    heavy_days = {}
    special_days = {}
    closed_holidays = []
    open_holidays = []
    
    for sd in req.specialDays:
        day_str = str(sd.day)
        
        if sd.type == "holiday_closed":
            closed_holidays.append(sd.day)
        elif sd.type == "holiday_open":
            open_holidays.append(sd.day)
            # Maybe set special hours? Defaulting to standard special day logic if needed
            # For now, just marking it as open holiday might be enough if scheduler logic uses it
            # Scheduler logic uses 'special_days' dict for close times.
            # If user didn't specify time, maybe we assume standard holiday hours (e.g. close 17:00)?
            # Or just treat as normal day but with holiday pay?
            # Let's assume holiday_open means standard holiday hours.
            special_days[day_str] = {"close": "17:00", "staff": 3} # Default assumption
            
        if sd.busy and sd.type != "holiday_closed":
            heavy_days[day_str] = {"extra_staff": 2}

    # 3. Config
    config = {
        "auto_staffing": True,
        "busy_weekends": True,
        "min_openers": 1,
        "min_closers": 1,
        "open_ratio": 0.4,
        "close_ratio": 0.4,
        "manager_roles": ["manager", "deputy", "supervisor"] if req.requireManagerMondays else []
    }
    
    # 4. Weights (Defaults)
    weights = {
        "work_hours": 1000,
        "day_shape": 80,
        "shift_cost": 5,
        "open_close_fairness": 3,
        "clopen": 15
    }

    return {
        "year": req.year,
        "month": req.month,
        "full_time_hours": req.fulltimeHours,
        "employees": employees,
        "heavy_days": heavy_days,
        "special_days": special_days,
        "closed_holidays": closed_holidays,
        "open_holidays": open_holidays,
        "config": config,
        "weights": weights
    }

@app.post("/solve")
async def solve_schedule(request: SolveRequest):
    data = transform_request(request)
    
    try:
        result = scheduler.solve_schedule(data)
        if result.get("status") not in ("OPTIMAL", "FEASIBLE"):
             # Return result even if not optimal, so user sees the error
             # But if it's INFEASIBLE, we might want to show that.
             # Frontend expects 200 OK with result object.
             pass 
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Scheduler API is running"}
