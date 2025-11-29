import React, { useState } from 'react';
import type { EmployeeInput, Role, ContractType } from '../types';
import { AvailabilityModal } from './AvailabilityModal';

interface StoreConfigurationProps {
    fulltimeHours: number;
    setFulltimeHours: (h: number) => void;
    employees: EmployeeInput[];
    setEmployees: (emps: EmployeeInput[]) => void;
    requireManagerMondays: boolean;
    setRequireManagerMondays: (v: boolean) => void;
    month: number;
    year: number;
}

const ROLES: Role[] = ["manager", "deputy", "supervisor", "assistant"];
const CONTRACTS: ContractType[] = ["fulltime", "0.75", "0.5", "student", "custom"];

export const StoreConfiguration: React.FC<StoreConfigurationProps> = ({
    fulltimeHours, setFulltimeHours,
    employees, setEmployees,
    requireManagerMondays, setRequireManagerMondays,
    month, year
}) => {
    const [editingAvailability, setEditingAvailability] = useState<string | null>(null);

    const addEmployee = () => {
        const newEmp: EmployeeInput = {
            id: crypto.randomUUID(),
            name: "",
            role: "assistant",
            contract: "fulltime",
            targetHours: fulltimeHours,
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

            const updated = { ...e, ...updates };

            // Auto-calc target hours if contract changes
            if (updates.contract && updates.contract !== 'custom') {
                let factor = 1.0;
                if (updates.contract === '0.75') factor = 0.75;
                if (updates.contract === '0.5') factor = 0.5;
                if (updates.contract === 'student') factor = 0.3; // Assumption
                updated.targetHours = Math.round(fulltimeHours * factor);
            }

            return updated;
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
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Step 3 – Store settings for this month</h2>

            {/* Store Settings */}
            <div className="mb-8 max-w-xs">
                <label className="block text-sm font-medium text-slate-700 mb-1">Full-time monthly hours</label>
                <input
                    type="number"
                    value={fulltimeHours}
                    onChange={(e) => setFulltimeHours(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 184"
                    className="w-full rounded-lg border-slate-300 border px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Enter the standard monthly hours for a full-time contract for this month.</p>
            </div>

            {/* Employees Table */}
            <h3 className="text-md font-semibold text-slate-900 mb-3">Employees</h3>
            <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm text-left min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-3 py-2 rounded-tl-lg">Name</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Contract</th>
                            <th className="px-3 py-2 w-24">Target (h)</th>
                            <th className="px-3 py-2 text-center">Availability</th>
                            <th className="px-3 py-2 rounded-tr-lg w-10"></th>
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
                                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none py-1"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <select
                                        value={emp.role}
                                        onChange={(e) => updateEmployee(emp.id, { role: e.target.value as Role })}
                                        className="w-full bg-transparent outline-none py-1"
                                    >
                                        {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                </td>
                                <td className="px-3 py-2">
                                    <select
                                        value={emp.contract}
                                        onChange={(e) => updateEmployee(emp.id, { contract: e.target.value as ContractType })}
                                        className="w-full bg-transparent outline-none py-1"
                                    >
                                        {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="number"
                                        value={emp.targetHours}
                                        onChange={(e) => updateEmployee(emp.id, { targetHours: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none py-1"
                                    />
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <button
                                        onClick={() => setEditingAvailability(emp.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        Edit availability
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
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center">
                <button
                    onClick={addEmployee}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Add employee
                </button>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={requireManagerMondays}
                        onChange={(e) => setRequireManagerMondays(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">On every Monday there must be at least one manager (Store / Deputy / Supervisor) on shift.</span>
                </label>
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
