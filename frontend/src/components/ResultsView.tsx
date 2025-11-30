import React, { useState } from 'react';
import type { SolveResponse, ScheduleShift, EmployeeInput, SpecialDayInput } from '../types';

interface ResultsViewProps {
    results: SolveResponse;
    month: number;
    year: number;
    onUpdateResults: (newResults: SolveResponse) => void;
    inputEmployees: EmployeeInput[];
    specialDays: SpecialDayInput[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Time options for editing (06:00 - 23:00)
const TIME_OPTIONS = Array.from({ length: 35 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 30;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60 === 0 ? "00" : "30";
    return `${h.toString().padStart(2, '0')}:${m}`;
});

export const ResultsView: React.FC<ResultsViewProps> = ({
    results, month, year, onUpdateResults, inputEmployees, specialDays
}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'by_day' | 'by_employee'>('summary');
    const [editingShift, setEditingShift] = useState<{ day: number, empName: string, shift: ScheduleShift | null } | null>(null);

    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    const getWeekday = (day: number) => {
        const date = new Date(year, month - 1, day);
        return WEEKDAYS[date.getDay()];
    };

    const getShiftForEmployee = (day: number, empName: string): ScheduleShift | null => {
        const dayStr = day.toString();
        if (results.schedule[dayStr] && results.schedule[dayStr][empName]) {
            return results.schedule[dayStr][empName];
        }
        return null;
    };

    const getEmployeeInput = (empName: string) => {
        return inputEmployees.find(e => e.name === empName);
    };

    const getSpecialDay = (day: number) => {
        return specialDays.find(d => d.day === day);
    };

    const getPaidHoursCredit = (fte: number) => {
        if (fte >= 1.0) return 8;
        if (fte >= 0.75) return 6;
        return 4;
    };

    const handleEditClick = (day: number, empName: string, shift: ScheduleShift | null) => {
        setEditingShift({ day, empName, shift });
    };

    const handleSaveShift = (start: string, end: string) => {
        if (!editingShift) return;

        const { day, empName } = editingShift;
        const dayStr = day.toString();

        // Calculate duration
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const duration = (eh + em / 60) - (sh + sm / 60);

        const newShift: ScheduleShift = {
            start,
            end,
            duration,
            type: 'MANUAL' // Mark as manual
        };

        // Deep copy results to mutate
        const newResults = JSON.parse(JSON.stringify(results));

        if (!newResults.schedule[dayStr]) {
            newResults.schedule[dayStr] = {};
        }
        newResults.schedule[dayStr][empName] = newShift;

        // Recalculate stats
        recalculateStats(newResults);

        onUpdateResults(newResults);
        setEditingShift(null);
    };

    const handleClearShift = () => {
        if (!editingShift) return;
        const { day, empName } = editingShift;
        const dayStr = day.toString();

        const newResults = JSON.parse(JSON.stringify(results));
        if (newResults.schedule[dayStr] && newResults.schedule[dayStr][empName]) {
            delete newResults.schedule[dayStr][empName];
        }

        recalculateStats(newResults);
        onUpdateResults(newResults);
        setEditingShift(null);
    };

    const recalculateStats = (res: SolveResponse) => {
        // Re-compute employee stats based on current schedule
        res.employees.forEach(emp => {
            let worked = 0;
            let opens = 0;
            let closes = 0;
            let middle = 0;

            Object.values(res.schedule).forEach(dayShifts => {
                const shift = dayShifts[emp.name];
                if (shift) {
                    worked += shift.duration;
                    // Simple inference for stats if type is MANUAL, otherwise use existing type
                    if (shift.type === 'OPEN' || shift.type === 'FIXED') opens++; // Assuming FIXED counts as open/close pair usually, but simplified here
                    else if (shift.type === 'CLOSE') closes++;
                    else if (shift.type === 'FLEX') middle++;
                    else if (shift.type === 'MANUAL') {
                        // Try to guess? Or just ignore for counts?
                        // Let's guess based on time
                        const startH = parseInt(shift.start.split(':')[0]);
                        const endH = parseInt(shift.end.split(':')[0]);
                        if (startH <= 9) opens++;
                        else if (endH >= 20) closes++;
                        else middle++;
                    }
                }
            });

            emp.worked = worked;
            emp.total = worked + emp.paid_off;
            emp.diff = emp.total - emp.target;
            emp.opens = opens;
            emp.closes = closes;
            emp.middle = middle;
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'summary' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Summary
                </button>
                <button
                    onClick={() => setActiveTab('by_day')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'by_day' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    By Day
                </button>
                <button
                    onClick={() => setActiveTab('by_employee')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'by_employee' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    By Employee
                </button>
            </div>

            <div className="p-6">
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Solver Status</h4>
                                <p className="text-lg font-bold text-slate-900">{results.solver_status || results.status}</p>
                                {results.solve_time_seconds !== undefined && (
                                    <p className="text-xs text-slate-500 mt-1">Time: {results.solve_time_seconds.toFixed(2)}s</p>
                                )}
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Period</h4>
                                <p className="text-lg font-bold text-slate-900">{month}/{year}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Balance</h4>
                                <p className="text-lg font-bold text-slate-900">
                                    {/* Avg absolute diff */}
                                    {(results.employees.reduce((acc, e) => acc + Math.abs(e.diff), 0) / results.employees.length).toFixed(1)}h
                                </p>
                                <p className="text-xs text-slate-400 mt-1">Avg. deviation</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Employee Statistics</h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-4 py-2 border-b">Name</th>
                                            <th className="px-4 py-2 border-b text-right">Target</th>
                                            <th className="px-4 py-2 border-b text-right">Scheduled</th>
                                            <th className="px-4 py-2 border-b text-right">Diff</th>
                                            <th className="px-4 py-2 border-b text-right">Opens</th>
                                            <th className="px-4 py-2 border-b text-right">Closes</th>
                                            <th className="px-4 py-2 border-b text-right">Middle</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {results.employees.map((emp, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 font-medium text-slate-900">{emp.name}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{emp.target.toFixed(1)}</td>
                                                <td className="px-4 py-2 text-right font-medium text-slate-900">{emp.total.toFixed(1)}</td>
                                                <td className={`px-4 py-2 text-right font-medium ${emp.diff > 0 ? 'text-green-600' : emp.diff < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                                    {emp.diff > 0 ? '+' : ''}{emp.diff.toFixed(1)}
                                                </td>
                                                <td className="px-4 py-2 text-right text-slate-500">{emp.opens}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{emp.closes}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{emp.middle}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {results.understaffed.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-red-800 mb-2">Understaffed Days</h3>
                                <ul className="list-disc list-inside text-sm text-red-700">
                                    {results.understaffed.map((u, i) => (
                                        <li key={i}>
                                            Day {u.day}: Needed {u.needed}, Available {u.available} (Deficit: {u.deficit})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'by_day' && (
                    <div className="space-y-6">
                        <div className="overflow-x-auto pb-20"> {/* Padding for popover space */}
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border-b border-slate-200 bg-slate-50 sticky left-0 z-10 w-20">Day</th>
                                        {results.employees.map((emp, i) => (
                                            <th key={i} className="p-2 border-b border-slate-200 bg-slate-50 min-w-[100px]">{emp.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {days.map(day => {
                                        const weekday = getWeekday(day);
                                        const specialDay = getSpecialDay(day);

                                        return (
                                            <tr key={day} className="hover:bg-slate-50 border-b border-slate-100">
                                                <td className="p-2 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-100">
                                                    {day} <span className="text-xs text-slate-400 font-normal ml-1">{weekday}</span>
                                                </td>
                                                {results.employees.map((emp, i) => {
                                                    const shift = getShiftForEmployee(day, emp.name);
                                                    const empInput = getEmployeeInput(emp.name);

                                                    // Determine status
                                                    const isUnavailable = empInput?.unavailableDays.includes(day);
                                                    const isVacation = empInput?.vacationDays.includes(day);
                                                    const isHolidayClosed = specialDay?.type === 'holiday_closed';
                                                    const isHolidayOpen = specialDay?.type === 'holiday_open';

                                                    const credit = empInput ? getPaidHoursCredit(empInput.contractFte) : 8;

                                                    return (
                                                        <td
                                                            key={i}
                                                            className="p-2 border-r border-slate-50 last:border-0 cursor-pointer hover:bg-slate-100 transition-colors align-middle"
                                                            onClick={() => handleEditClick(day, emp.name, shift)}
                                                        >
                                                            <div className="flex flex-col gap-1 items-center justify-center min-h-[40px]">
                                                                {shift ? (
                                                                    <div className={`relative text-xs p-1 rounded border w-full text-center ${shift.type === 'OPEN' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                                        shift.type === 'CLOSE' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                                            shift.type === 'FLEX' ? 'bg-green-100 text-green-800 border-green-200' :
                                                                                shift.type === 'MANUAL' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                                                                    'bg-slate-100 text-slate-800 border-slate-200'
                                                                        } ${isUnavailable ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}
                                                                        title={isUnavailable ? "Employee requested this day as unavailable" : ""}
                                                                    >
                                                                        <div className="font-semibold">{shift.start} - {shift.end}</div>
                                                                        <div className="text-[10px] opacity-75">{shift.type}</div>
                                                                        {isUnavailable && (
                                                                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* No Shift - Show status pills */}
                                                                        {isUnavailable && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 font-medium border border-red-200">
                                                                                UNAVAILABLE
                                                                            </span>
                                                                        )}
                                                                        {isVacation && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium border border-orange-200" title="Paid vacation">
                                                                                VACATION {credit}h
                                                                            </span>
                                                                        )}
                                                                        {isHolidayClosed && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium border border-teal-200" title="Store closed - Paid holiday">
                                                                                HOLIDAY {credit}h
                                                                            </span>
                                                                        )}
                                                                        {isHolidayOpen && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium border border-teal-200" title="Store open - Paid holiday">
                                                                                HOLIDAY {credit}h
                                                                            </span>
                                                                        )}
                                                                        {!isUnavailable && !isVacation && !isHolidayClosed && !isHolidayOpen && (
                                                                            <span className="text-slate-300 text-xs">-</span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                                <span>Open shift</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
                                <span>Close shift</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                                <span>Middle shift</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div>
                                <span>Vacation (paid)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-teal-100 border border-teal-200 rounded"></div>
                                <span>Holiday (paid)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                                <span>Unavailable / Day off</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'by_employee' && (
                    <div className="space-y-8">
                        {results.employees.map((emp, i) => (
                            <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-900">{emp.name}</h3>
                                    <div className="text-sm text-slate-500">
                                        Total: <span className="font-medium text-slate-900">{emp.total.toFixed(1)}h</span> / Target: {emp.target.toFixed(1)}h
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-7 gap-2">
                                        {days.map(day => {
                                            const shift = getShiftForEmployee(day, emp.name);
                                            const weekday = getWeekday(day);
                                            return (
                                                <div key={day} className={`p-2 rounded border text-center ${shift ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
                                                    <div className="text-xs text-slate-400 mb-1">{day} {weekday}</div>
                                                    {shift ? (
                                                        <div>
                                                            <div className="text-sm font-semibold text-blue-900">{shift.start}-{shift.end}</div>
                                                            <div className="text-[10px] text-blue-700">{shift.type}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-300">-</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Shift Modal/Popover */}
            {editingShift && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            Edit Shift: {editingShift.empName} (Day {editingShift.day})
                        </h3>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            handleSaveShift(formData.get('start') as string, formData.get('end') as string);
                        }}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                                    <select name="start" defaultValue={editingShift.shift?.start || "08:30"} className="w-full border border-slate-300 rounded-lg p-2">
                                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                                    <select name="end" defaultValue={editingShift.shift?.end || "17:00"} className="w-full border border-slate-300 rounded-lg p-2">
                                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={handleClearShift}
                                    className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium text-sm"
                                >
                                    Clear Shift
                                </button>
                                <div className="flex-1"></div>
                                <button
                                    type="button"
                                    onClick={() => setEditingShift(null)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium text-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
