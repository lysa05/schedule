import React, { useState } from 'react';
import type { SolveResponse } from '../types';

interface ResultsViewProps {
    results: SolveResponse;
    month: number;
    year: number;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, month, year }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'day' | 'employee'>('day');
    const [showDebug, setShowDebug] = useState(false);

    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);
    const employeeNames = results.employees.map(e => e.name);

    // Helper to get shift class
    const getShiftClass = (type: string) => {
        switch (type) {
            case 'OPEN': return 'bg-blue-100 text-blue-700';
            case 'CLOSE': return 'bg-purple-100 text-purple-700';
            case 'FLEX': return 'bg-yellow-100 text-yellow-700';
            case 'FIXED': return 'bg-red-100 text-red-700';
            case 'HOL': return 'bg-green-100 text-green-700';
            case 'VAC': return 'bg-slate-200 text-slate-600';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'summary' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Summary
                </button>
                <button
                    onClick={() => setActiveTab('day')}
                    className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'day' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    By day
                </button>
                <button
                    onClick={() => setActiveTab('employee')}
                    className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'employee' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    By employee
                </button>
            </div>

            <div className="p-6">
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-sm text-slate-500">Period</div>
                                <div className="text-xl font-semibold text-slate-900">{month}/{year}</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-sm text-slate-500">Employees</div>
                                <div className="text-xl font-semibold text-slate-900">{results.employees.length}</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-sm text-slate-500">Objective Value</div>
                                <div className="text-xl font-semibold text-slate-900">{results.objective_value}</div>
                            </div>
                        </div>

                        {results.understaffed && results.understaffed.length > 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h3 className="text-amber-800 font-medium mb-2">Warnings</h3>
                                <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                                    {results.understaffed.map((u, i) => (
                                        <li key={i}>Day {u.day}: needed {u.needed} but only {u.available} available (deficit {u.deficit}).</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="text-green-600 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                No staffing warnings found.
                            </div>
                        )}
                    </div>
                )}

                {/* By Day Tab */}
                {activeTab === 'day' && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Day</th>
                                    {employeeNames.map(name => (
                                        <th key={name} className="px-4 py-3 text-center">{name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {days.map(day => {
                                    const dayData = results.schedule[day.toString()] || {};
                                    const date = new Date(year, month - 1, day);
                                    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });

                                    return (
                                        <tr key={day} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                                                {day} <span className="text-slate-400 font-normal ml-1">{weekday}</span>
                                            </td>
                                            {employeeNames.map(name => {
                                                const shift = dayData[name];
                                                let content = '-';
                                                let type = 'x';

                                                if (shift) {
                                                    content = `${shift.start}-${shift.end}`;
                                                    type = shift.type;
                                                }

                                                // Check if we can infer HOL/VAC from type or need extra logic?
                                                // The backend returns type 'HOL' or 'VAC' if we modify it to do so?
                                                // Currently backend returns only scheduled shifts. 
                                                // But wait, the previous JS frontend logic checked holidays/vacations from input data.
                                                // The backend response currently DOES NOT include HOL/VAC/x markers for days off.
                                                // It only includes worked shifts.
                                                // We should probably enhance the backend or handle it here if we have access to input data.
                                                // For now, let's just show what we have.

                                                return (
                                                    <td key={name} className="px-2 py-2 text-center">
                                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getShiftClass(type)}`}>
                                                            {content}
                                                        </span>
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

                {/* By Employee Tab */}
                {activeTab === 'employee' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Name</th>
                                    <th className="px-4 py-3 text-right">Worked</th>
                                    <th className="px-4 py-3 text-right">Paid Off</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Target</th>
                                    <th className="px-4 py-3 text-right">Diff</th>
                                    <th className="px-4 py-3 text-center">Open</th>
                                    <th className="px-4 py-3 text-center">Close</th>
                                    <th className="px-4 py-3 text-center">Middle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.employees.map(emp => (
                                    <tr key={emp.name} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
                                        <td className="px-4 py-3 text-right">{emp.worked.toFixed(1)}</td>
                                        <td className="px-4 py-3 text-right">{emp.paid_off.toFixed(1)}</td>
                                        <td className="px-4 py-3 text-right font-medium">{emp.total.toFixed(1)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{emp.target}</td>
                                        <td className={`px-4 py-3 text-right font-medium ${emp.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {emp.diff > 0 ? '+' : ''}{emp.diff.toFixed(1)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-600">{emp.opens}</td>
                                        <td className="px-4 py-3 text-center text-slate-600">{emp.closes}</td>
                                        <td className="px-4 py-3 text-center text-slate-600">{emp.middle}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Debug Section */}
            <div className="border-t border-slate-200 p-4 bg-slate-50">
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                    {showDebug ? "Hide Advanced Debug" : "Show Advanced Debug"}
                </button>

                {showDebug && (
                    <div className="mt-4 text-xs font-mono text-slate-600 overflow-auto max-h-60">
                        <pre>{JSON.stringify(results, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};
