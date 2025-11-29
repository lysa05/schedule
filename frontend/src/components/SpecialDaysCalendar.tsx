import React, { useState, useRef, useEffect } from 'react';
import type { SpecialDayInput, DayType } from '../types';

interface SpecialDaysCalendarProps {
    month: number;
    year: number;
    specialDays: SpecialDayInput[];
    onChange: (days: SpecialDayInput[]) => void;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const SpecialDaysCalendar: React.FC<SpecialDaysCalendarProps> = ({ month, year, specialDays, onChange }) => {
    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);
    const [openPopover, setOpenPopover] = useState<number | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setOpenPopover(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDayState = (day: number): DayType => {
        return specialDays.find(d => d.day === day)?.type || 'normal';
    };

    const setDayState = (day: number, type: DayType) => {
        const newDays = specialDays.filter(d => d.day !== day);
        if (type !== 'normal') {
            newDays.push({ day, type });
        }
        onChange(newDays);
        setOpenPopover(null);
    };

    const clearAll = () => {
        onChange([]);
    };

    const getDayColor = (type: DayType) => {
        switch (type) {
            case 'busy': return 'bg-amber-100 border-amber-300 text-amber-800';
            case 'holiday_closed': return 'bg-red-100 border-red-300 text-red-800';
            case 'holiday_open': return 'bg-green-100 border-green-300 text-green-800';
            case 'holiday_short': return 'bg-blue-100 border-blue-300 text-blue-800';
            default: return 'bg-white border-slate-200 text-slate-700 hover:border-blue-300';
        }
    };

    const getDayLabel = (type: DayType) => {
        switch (type) {
            case 'busy': return 'Busy';
            case 'holiday_closed': return 'Closed';
            case 'holiday_open': return 'Open';
            case 'holiday_short': return 'Short';
            default: return 'Norm';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Step 2 – Special days</h2>
                    <p className="text-sm text-slate-500">
                        {MONTHS[month - 1]} {year}
                    </p>
                </div>
                <button onClick={clearAll} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                    Clear all
                </button>
            </div>

            <div className="grid grid-cols-7 gap-2 relative">
                {days.map(day => {
                    const type = getDayState(day);
                    const isOpen = openPopover === day;

                    return (
                        <div key={day} className="relative">
                            <button
                                onClick={() => setOpenPopover(isOpen ? null : day)}
                                className={`
                  w-full aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-all
                  ${getDayColor(type)}
                  ${isOpen ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
                `}
                            >
                                <span className="font-semibold text-lg">{day}</span>
                                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                                    {getDayLabel(type)}
                                </span>
                            </button>

                            {isOpen && (
                                <div
                                    ref={popoverRef}
                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden"
                                >
                                    <div className="p-1 flex flex-col gap-0.5">
                                        {[
                                            { id: 'normal', label: 'Normal day', color: 'text-slate-700 hover:bg-slate-50' },
                                            { id: 'busy', label: 'Busy day', color: 'text-amber-700 hover:bg-amber-50' },
                                            { id: 'holiday_closed', label: 'Holiday – Closed', color: 'text-red-700 hover:bg-red-50' },
                                            { id: 'holiday_open', label: 'Holiday – Open', color: 'text-green-700 hover:bg-green-50' },
                                            { id: 'holiday_short', label: 'Holiday – Short', color: 'text-blue-700 hover:bg-blue-50' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setDayState(day, opt.id as DayType)}
                                                className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${opt.color} ${type === opt.id ? 'bg-slate-100 font-semibold' : ''}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
