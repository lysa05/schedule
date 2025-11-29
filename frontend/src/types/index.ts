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
    objective_value: number;
    schedule: ScheduleOutput;
    employees: EmployeeStat[];
    understaffed: UnderstaffedDay[];
}

export type DayType = "normal" | "holiday_open" | "holiday_closed";

export interface SpecialDayInput {
    day: number;
    type: DayType;
    busy: boolean;
}

export type Role = "manager" | "deputy" | "supervisor" | "assistant";
export type ContractType = "fulltime" | "0.75" | "0.5" | "student" | "custom";

export interface EmployeeInput {
    id: string;
    name: string;
    role: Role;
    contract: ContractType;
    targetHours: number;
    unavailableDays: number[];
    vacationDays: number[];
}

export interface SolveRequest {
    month: number;
    year: number;
    fulltimeHours: number;
    employees: EmployeeInput[];
    specialDays: SpecialDayInput[];
    requireManagerMondays: boolean;
}

export type SpecialDayType = 'holiday' | 'busy' | null;
