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

class Employee(BaseModel):
    name: str
    role: str
    contract_type: float
    unavailable_days: List[int] = []
    vacation_days: List[int] = []
    hours_fund: Optional[float] = None

class DayConfig(BaseModel):
    extra_staff: int = 0
    close: Optional[str] = None
    staff: Optional[int] = None

class Config(BaseModel):
    auto_staffing: bool = True
    busy_weekends: bool = True
    min_openers: int = 1
    min_closers: int = 1
    open_ratio: float = 0.4
    close_ratio: float = 0.4
    manager_roles: List[str] = ["manager", "deputy", "supervisor"]

class Weights(BaseModel):
    work_hours: int = 1000
    day_shape: int = 80
    shift_cost: int = 5
    open_close_fairness: int = 3
    clopen: int = 15

class ScheduleRequest(BaseModel):
    year: int
    month: int
    full_time_hours: float
    employees: List[Employee]
    heavy_days: Dict[str, DayConfig] = {}
    special_days: Dict[str, DayConfig] = {}
    closed_holidays: List[int] = []
    open_holidays: List[int] = []
    config: Config
    weights: Weights

@app.post("/solve")
async def solve_schedule(request: ScheduleRequest):
    data = request.dict()
    # Pydantic converts keys to strings, but our logic might expect ints for some things?
    # Actually the JSON keys for heavy_days/special_days are strings in the input JSON too.
    # So it should be fine.
    
    try:
        result = scheduler.solve_schedule(data)
        if result.get("status") not in ("OPTIMAL", "FEASIBLE"):
             raise HTTPException(status_code=400, detail=f"No solution found: {result.get('status')}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Scheduler API is running"}
