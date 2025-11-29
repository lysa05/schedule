import React from 'react';

interface PeriodSelectorProps {
    month: number;
    year: number;
    onChange: (month: number, year: number) => void;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ month, year, onChange }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Step 1 – Select period</h2>
            <p className="text-sm text-slate-500 mb-4">Select the month and year for which you want to generate the shift schedule.</p>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                    <select
                        value={month}
                        onChange={(e) => onChange(parseInt(e.target.value), year)}
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        {MONTHS.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                    <input
                        type="number"
                        value={year}
                        onChange={(e) => onChange(month, parseInt(e.target.value))}
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
            </div>
        </div>
    );
};
