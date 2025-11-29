import React from 'react';

interface PeriodSelectorProps {
    month: number;
    year: number;
    onChange: (month: number) => void;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ month, year, onChange }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4">
            <div className="flex-1">
                <h2 className="text-base font-semibold text-slate-900">Step 1 – Select period</h2>
            </div>

            <div className="flex items-center gap-2">
                <select
                    value={month}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                    className="rounded-lg border-slate-300 border px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium"
                >
                    {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                    ))}
                </select>
                <span className="text-slate-500 font-medium text-sm">{year}</span>
            </div>
        </div>
    );
};
