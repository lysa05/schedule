import React, { useState } from 'react';
import type { EmployeeInput, Role } from '../types';
import { AvailabilityModal } from './AvailabilityModal';

interface StoreConfigurationProps {
    fulltimeHours: number;
    setFulltimeHours: (h: number) => void;
    employees: EmployeeInput[];
    setEmployees: (emps: EmployeeInput[]) => void;
    config: { autoStaffing: boolean; busyWeekends: boolean };
    setConfig: (c: { autoStaffing: boolean; busyWeekends: boolean }) => void;
    month: number;
    year: number;
}

const ROLES: { value: Role; label: string }[] = [
    { value: "manager", label: "Manager" },
    { value: "deputy", label: "Deputy" },
    { value: "supervisor", label: "Supervisor" },
    { value: "visual_merchandiser", label: "VM" },
    { value: "assistant", label: "Assistant" },
];

const CONTRACTS = [1.0, 0.75, 0.5];

export const StoreConfiguration: React.FC<StoreConfigurationProps> = ({
    fulltimeHours, setFulltimeHours,
    employees, setEmployees,
    config, setConfig,
    month, year
}) => {
    const [editingAvailability, setEditingAvailability] = useState<string | null>(null);

    const addEmployee = () => {
        const newEmp: EmployeeInput = {
            id: crypto.randomUUID(),
            name: "",
            role: "assistant",
            contractFte: 1.0,
            unavailableDays: [],
            vacationDays: []
        };
        setEmployees([...employees, newEmp]);
    };

    const removeEmployee = (id: string) => {
        setEmployees(employees.filter(e => e.id !== id));
    };

    const updateEmployee = (id: string, updates: Partial<EmployeeInput>) => {
        setEmployees(employees.map(e => {
            if (e.id !== id) return e;
            return { ...e, ...updates };
        }));
    };

    const handleAvailabilitySave = (unavailable: number[], vacation: number[]) => {
        if (editingAvailability) {
            updateEmployee(editingAvailability, { unavailableDays: unavailable, vacationDays: vacation });
        }
    };

    const editingEmployee = employees.find(e => e.id === editingAvailability);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Step 2 – Store settings & employees</h2>

            {/* Store Settings */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Full-time monthly hours</label>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        value={fulltimeHours}
                        onChange={(e) => setFulltimeHours(parseFloat(e.target.value) || 0)}
                        placeholder="184"
                        className="w-32 rounded-lg border-slate-300 border px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-xs text-slate-500">Enter the standard monthly hours for a 1.0 FTE contract for this month.</span>
                </div>
            </div>

            {/* Employees Table */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Employees</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm text-left min-w-[700px]">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-3 py-2 border-b border-slate-200">Name</th>
                                <th className="px-3 py-2 border-b border-slate-200">Role</th>
                                <th className="px-3 py-2 border-b border-slate-200">FTE</th>
                                <th className="px-3 py-2 border-b border-slate-200 w-20">Target</th>
                                <th className="px-3 py-2 border-b border-slate-200 text-center">Availability</th>
                                <th className="px-3 py-2 border-b border-slate-200 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={emp.name}
                                            onChange={(e) => updateEmployee(emp.id, { name: e.target.value })}
                                            placeholder="Name"
                                            className="w-full bg-transparent focus:border-blue-500 outline-none py-1 border-b border-transparent"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <select
                                                value={emp.role}
                                                onChange={(e) => updateEmployee(emp.id, { role: e.target.value as Role })}
                                                className="w-full bg-transparent outline-none py-1 pr-4 appearance-none cursor-pointer"
                                            >
                                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-slate-400">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <select
                                                value={emp.contractFte}
                                                onChange={(e) => updateEmployee(emp.id, { contractFte: parseFloat(e.target.value) })}
                                                className="w-full bg-transparent outline-none py-1 pr-4 appearance-none cursor-pointer"
                                            >
                                                {CONTRACTS.map(c => <option key={c} value={c}>{c.toFixed(2)}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-slate-400">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-slate-500 font-mono">
                                        {Math.round(fulltimeHours * emp.contractFte)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => setEditingAvailability(emp.id)}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Edit
                                            {(emp.unavailableDays.length > 0 || emp.vacationDays.length > 0) && (
                                                <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 rounded-full">
                                                    {emp.unavailableDays.length + emp.vacationDays.length}
                                                </span>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => removeEmployee(emp.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            aria-label="Remove employee"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-start">
                    <button
                        onClick={addEmployee}
                        className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        + Add employee
                    </button>
                </div>
            </div>

            {/* Staffing Rules */}
            <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Staffing rules</h3>
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={config.busyWeekends}
                                onChange={(e) => setConfig({ ...config, busyWeekends: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-slate-700">Treat weekends as busier days</span>
                            <p className="text-xs text-slate-500">If enabled, Saturdays and Sundays will be staffed more heavily than weekdays.</p>
                        </div>
                    </label>
                </div>
            </div>

            {editingEmployee && (
                <AvailabilityModal
                    isOpen={!!editingAvailability}
                    onClose={() => setEditingAvailability(null)}
                    employeeName={editingEmployee.name}
                    month={month}
                    year={year}
                    unavailableDays={editingEmployee.unavailableDays}
                    vacationDays={editingEmployee.vacationDays}
                    onSave={handleAvailabilitySave}
                />
            )}
        </div>
    );
};
