import React from 'react';
import type { SpecialDayType } from '../types';

interface SpecialDaysCalendarProps {
    month: number;
    year: number;
    specialDays: Map<number, SpecialDayType>;
    onToggleDay: (day: number, type: SpecialDayType) => void;
}

export const SpecialDaysCalendar: React.FC<SpecialDaysCalendarProps> = ({ month, year, specialDays, onToggleDay }) => {
    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Step 2 – Special days</h2>
            <p className="text-sm text-slate-500 mb-4">Mark days when your store is closed (Holidays) or especially busy (Busy days).</p>

            <div className="grid grid-cols-7 gap-2">
                {days.map(day => {
                    const status = specialDays.get(day);

                    return (
                        <div key={day} className={`
              border rounded-lg p-2 flex flex-col items-center gap-2 transition-colors
              ${status === 'holiday' ? 'bg-green-50 border-green-200' :
                                status === 'busy' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}
            `}>
                            <span className="font-medium text-slate-700">{day}</span>

                            <div className="flex gap-1">
                                <button
                                    onClick={() => onToggleDay(day, status === 'holiday' ? null : 'holiday')}
                                    className={`
                    text-xs px-2 py-1 rounded-full transition-colors
                    ${status === 'holiday'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}
                  `}
                                >
                                    Hol
                                </button>
                                <button
                                    onClick={() => onToggleDay(day, status === 'busy' ? null : 'busy')}
                                    className={`
                    text-xs px-2 py-1 rounded-full transition-colors
                    ${status === 'busy'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}
                  `}
                                >
                                    Busy
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
