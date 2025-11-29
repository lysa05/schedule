import React, { useState } from 'react';
import type { SolveResponse, ScheduleShift } from '../types';

interface ResultsViewProps {
    results: SolveResponse;
    month: number;
    year: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ResultsView: React.FC<ResultsViewProps> = ({ results, month, year }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'by_day' | 'by_employee'>('summary');

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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Status</h4>
                                <p className="text-lg font-bold text-slate-900">{results.status}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Period</h4>
                                <p className="text-lg font-bold text-slate-900">{month}/{year}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Employees</h4>
                                <p className="text-lg font-bold text-slate-900">{results.employees.length}</p>
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
                    <div className="overflow-x-auto">
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
                                    return (
                                        <tr key={day} className="hover:bg-slate-50 border-b border-slate-100">
                                            <td className="p-2 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-100">
                                                {day} <span className="text-xs text-slate-400 font-normal ml-1">{weekday}</span>
                                            </td>
                                            {results.employees.map((emp, i) => {
                                                const shift = getShiftForEmployee(day, emp.name);
                                                return (
                                                    <td key={i} className="p-2 border-r border-slate-50 last:border-0">
                                                        {shift ? (
                                                            <div className={`text-xs p-1 rounded ${shift.type === 'OPEN' ? 'bg-blue-100 text-blue-800' :
                                                                    shift.type === 'CLOSE' ? 'bg-indigo-100 text-indigo-800' :
                                                                        shift.type === 'FLEX' ? 'bg-purple-100 text-purple-800' :
                                                                            'bg-slate-100 text-slate-800'
                                                                }`}>
                                                                <div className="font-semibold">{shift.start} - {shift.end}</div>
                                                                <div className="text-[10px] opacity-75">{shift.type}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
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
        </div>
    );
};
