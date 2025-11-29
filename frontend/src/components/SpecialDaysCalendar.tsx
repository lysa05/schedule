import React from 'react';
import type { SpecialDayInput } from '../types';

interface SpecialDaysCalendarProps {
    month: number;
    year: number;
    specialDays: SpecialDayInput[];
    onChange: (days: SpecialDayInput[]) => void;
}

export const SpecialDaysCalendar: React.FC<SpecialDaysCalendarProps> = ({ month, year, specialDays, onChange }) => {
    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    const getDayState = (day: number): SpecialDayInput => {
        return specialDays.find(d => d.day === day) || { day, type: 'normal', busy: false };
    };

    const updateDay = (day: number, updates: Partial<SpecialDayInput>) => {
        const current = getDayState(day);
        const updated = { ...current, ...updates };

        // If type is holiday_closed, busy must be false
        if (updated.type === 'holiday_closed') {
            updated.busy = false;
        }

        const newDays = specialDays.filter(d => d.day !== day);
        // Only keep if it's not default state
        if (updated.type !== 'normal' || updated.busy) {
            newDays.push(updated);
        }
        onChange(newDays);
    };

    const setWeekendsClosed = () => {
        const newDays = [...specialDays];
        for (let day = 1; day <= numDays; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                // Remove existing entry for this day
                const idx = newDays.findIndex(d => d.day === day);
                if (idx >= 0) newDays.splice(idx, 1);
                // Add closed
                newDays.push({ day, type: 'holiday_closed', busy: false });
            }
        }
        onChange(newDays);
    };

    const clearAll = () => {
        onChange([]);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">Step 2 – Special days</h2>
                    <p className="text-sm text-slate-500">Mark days when your store is closed, on public holidays, or especially busy.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={setWeekendsClosed} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                        Set weekends closed
                    </button>
                    <button onClick={clearAll} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                        Clear all
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {days.map(day => {
                    const state = getDayState(day);
                    const isClosed = state.type === 'holiday_closed';
                    const isOpenHol = state.type === 'holiday_open';

                    return (
                        <div key={day} className={`
              border rounded-lg p-2 flex flex-col gap-2 transition-colors
              ${isClosed ? 'bg-green-100 border-green-300' :
                                isOpenHol ? 'bg-green-50 border-green-200' :
                                    state.busy ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}
            `}>
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-700">{day}</span>
                                <button
                                    onClick={() => updateDay(day, { busy: !state.busy })}
                                    disabled={isClosed}
                                    className={`
                    w-4 h-4 rounded-full border flex items-center justify-center transition-colors
                    ${state.busy ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}
                    ${isClosed ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                                    title="Busy Day"
                                >
                                    {state.busy && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </button>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex rounded-md bg-slate-100 p-0.5">
                                    <button
                                        onClick={() => updateDay(day, { type: 'normal' })}
                                        className={`flex-1 text-[10px] py-1 rounded-sm transition-colors ${state.type === 'normal' ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Norm
                                    </button>
                                    <button
                                        onClick={() => updateDay(day, { type: 'holiday_open' })}
                                        className={`flex-1 text-[10px] py-1 rounded-sm transition-colors ${state.type === 'holiday_open' ? 'bg-white shadow-sm text-green-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Open
                                    </button>
                                    <button
                                        onClick={() => updateDay(day, { type: 'holiday_closed' })}
                                        className={`flex-1 text-[10px] py-1 rounded-sm transition-colors ${state.type === 'holiday_closed' ? 'bg-white shadow-sm text-green-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
