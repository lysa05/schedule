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
    type: str  # "normal", "busy", "holiday_closed", "holiday_open", "holiday_short"
    openTime: Optional[str] = None
    closeTime: Optional[str] = None
    staffOverride: Optional[int] = None

class EmployeeInput(BaseModel):
    id: str
    name: str
    role: str
    contractFte: float
    unavailableDays: List[int]
    vacationDays: List[int]

class ConfigInput(BaseModel):
    autoStaffing: bool
    busyWeekends: bool

class SolveRequest(BaseModel):
    month: int
    year: int
    fulltimeHours: float
    defaultOpenTime: str
    defaultCloseTime: str
    employees: List[EmployeeInput]
    specialDays: List[SpecialDayInput]
    config: ConfigInput

def transform_request(req: SolveRequest) -> Dict[str, Any]:
    # Convert new frontend payload to old backend dict structure
    
    # 1. Employees
    employees = []
    for e in req.employees:
        # Calculate target hours from FTE
        target_hours = req.fulltimeHours * e.contractFte
        
        employees.append({
            "name": e.name,
            "role": e.role,
            "contract_type": e.contractFte,
            "hours_fund": target_hours,
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
            # Use provided times or defaults
            special_days[day_str] = {
                "close": sd.closeTime or "17:00", 
                "open": sd.openTime or "08:30",
                "staff": sd.staffOverride or 3
            }
        elif sd.type == "holiday_short":
            open_holidays.append(sd.day)
            special_days[day_str] = {
                "close": sd.closeTime or "16:00", 
                "open": sd.openTime or "08:30",
                "staff": sd.staffOverride or 2
            }
        elif sd.type == "busy":
            heavy_days[day_str] = {"extra_staff": 2}

    # 3. Config
    backend_config = {
        "auto_staffing": req.config.autoStaffing,
        "busy_weekends": req.config.busyWeekends,
        "min_openers": 1,
        "min_closers": 1,
        "open_ratio": 0.4,
        "close_ratio": 0.4,
        "manager_roles": ["manager", "deputy", "supervisor"],
        "default_open_time": req.defaultOpenTime,
        "default_close_time": req.defaultCloseTime
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
        "config": backend_config,
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
