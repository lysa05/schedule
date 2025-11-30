export interface ScheduleShift {
    start: string;
    end: string;
    type: string;
    duration: number;
}

export interface ScheduleDay {
    [employeeName: string]: ScheduleShift;
}

export interface ScheduleOutput {
    [day: string]: ScheduleDay;
}

export interface EmployeeStat {
    name: string;
    worked: number;
    paid_off: number;
    total: number;
    target: number;
    diff: number;
    opens: number;
    closes: number;
    middle: number;
}

export interface UnderstaffedDay {
    day: number;
    needed: number;
    available: number;
    deficit: number;
}

export interface SolveResponse {
    status: string;
    solver_status?: string;
    solve_time_seconds?: number;
    best_bound?: number;
    objective_value: number;
    schedule: ScheduleOutput;
    employees: EmployeeStat[];
    understaffed: UnderstaffedDay[];
}

export type DayType = "normal" | "busy" | "holiday_closed" | "holiday_open" | "holiday_short_paid" | "holiday_short_unpaid";

export interface SpecialDayInput {
    day: number;
    type: DayType;
    openTime?: string;
    closeTime?: string;
    staffOverride?: number;
}

export type Role = "manager" | "deputy" | "supervisor" | "visual_merchandiser" | "assistant";
export type ContractType = "fulltime" | "0.75" | "0.5" | "student" | "custom";

export interface EmployeeInput {
    id: string;
    name: string;
    role: Role;
    contractFte: number; // 1.0, 0.75, 0.5, 0.25
    unavailableDays: number[];
    vacationDays: number[];
}

export interface SolveRequest {
    month: number;
    year: number;
    fulltimeHours: number;
    defaultOpenTime: string;
    defaultCloseTime: string;
    employees: EmployeeInput[];
    specialDays: SpecialDayInput[];
    config: {
        autoStaffing: boolean;
        busyWeekends: boolean;
    };
}

export type SpecialDayType = 'holiday' | 'busy' | null;
