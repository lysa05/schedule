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

export interface SolveRequest {
    year: number;
    month: number;
    full_time_hours: number;
    employees: any[];
    heavy_days: Record<string, { extra_staff: number }>;
    special_days: Record<string, { close: string; staff: number }>;
    closed_holidays: number[];
    open_holidays: number[];
    config: any;
    weights: any;
}

export type SpecialDayType = 'holiday' | 'busy' | null;
