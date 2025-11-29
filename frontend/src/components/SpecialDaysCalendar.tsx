import React, { useState, useRef, useEffect } from 'react';
import type { SpecialDayInput, DayType } from '../types';

interface SpecialDaysCalendarProps {
    month: number;
    year: number;
    setMonth: (m: number) => void;
    specialDays: SpecialDayInput[];
    onChange: (days: SpecialDayInput[]) => void;
    defaultOpenTime: string;
    setDefaultOpenTime: (t: string) => void;
    defaultCloseTime: string;
    setDefaultCloseTime: (t: string) => void;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
    const h = 8 + Math.floor(i / 2);
    const m = i % 2 === 0 ? "00" : "30";
    return `${h.toString().padStart(2, '0')}:${m}`;
});

export const SpecialDaysCalendar: React.FC<SpecialDaysCalendarProps> = ({
    month, year, setMonth, specialDays, onChange,
    defaultOpenTime, setDefaultOpenTime, defaultCloseTime, setDefaultCloseTime
}) => {
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

    const getDayData = (day: number): SpecialDayInput => {
        return specialDays.find(d => d.day === day) || { day, type: 'normal' };
    };

    const updateDay = (day: number, updates: Partial<SpecialDayInput>) => {
        const current = getDayData(day);
        const updated = { ...current, ...updates };

        const newDays = specialDays.filter(d => d.day !== day);
        if (updated.type !== 'normal') {
            newDays.push(updated);
        }
        onChange(newDays);
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
            case 'busy': return 'BUSY';
            case 'holiday_closed': return 'CLOSED';
            case 'holiday_open': return 'OPEN';
            case 'holiday_short': return 'SHORT';
            default: return 'NORMAL';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-900">Step 1 – Special days</h2>
                    <button onClick={clearAll} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                        Clear all
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    {/* Month Selector */}
                    <div className="flex items-center gap-4 bg-slate-50 rounded-lg p-1">
                        <button
                            onClick={() => setMonth(month === 1 ? 12 : month - 1)}
                            className="p-2 hover:bg-white rounded-md text-slate-500 hover:text-slate-900 transition-colors shadow-sm"
                        >
                            ◀
                        </button>
                        <span className="font-semibold text-slate-900 w-24 text-center select-none">
                            {MONTHS[month - 1]}
                        </span>
                        <button
                            onClick={() => setMonth(month === 12 ? 1 : month + 1)}
                            className="p-2 hover:bg-white rounded-md text-slate-500 hover:text-slate-900 transition-colors shadow-sm"
                        >
                            ▶
                        </button>
                    </div>

                    {/* Store Hours */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                        <span>Store hours:</span>
                        <select
                            value={defaultOpenTime}
                            onChange={(e) => setDefaultOpenTime(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-900 outline-none focus:border-blue-500"
                        >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span>–</span>
                        <select
                            value={defaultCloseTime}
                            onChange={(e) => setDefaultCloseTime(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-900 outline-none focus:border-blue-500"
                        >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 relative">
                {days.map(day => {
                    const data = getDayData(day);
                    const isOpen = openPopover === day;

                    return (
                        <div key={day} className="relative">
                            <button
                                onClick={() => setOpenPopover(isOpen ? null : day)}
                                className={`
                  w-full aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-all
                  ${getDayColor(data.type)}
                  ${isOpen ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
                `}
                            >
                                <span className="font-semibold text-lg">{day}</span>
                                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                                    {getDayLabel(data.type)}
                                </span>
                            </button>

                            {isOpen && (
                                <div
                                    ref={popoverRef}
                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden"
                                >
                                    <div className="p-1 flex flex-col gap-0.5">
                                        {[
                                            { id: 'normal', label: 'Normal day', color: 'text-slate-700 hover:bg-slate-50' },
                                            { id: 'busy', label: 'Busy day', color: 'text-amber-700 hover:bg-amber-50' },
                                            { id: 'holiday_closed', label: 'Store closed', color: 'text-red-700 hover:bg-red-50' },
                                            { id: 'holiday_short', label: 'Short opening hours', color: 'text-blue-700 hover:bg-blue-50' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => updateDay(day, { type: opt.id as DayType })}
                                                className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${opt.color} ${data.type === opt.id ? 'bg-slate-100 font-semibold' : ''}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {data.type === 'holiday_short' && (
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-600">Open from</span>
                                                <select
                                                    value={data.openTime || defaultOpenTime}
                                                    onChange={(e) => updateDay(day, { openTime: e.target.value })}
                                                    className="bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-900 outline-none"
                                                >
                                                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-600">Close at</span>
                                                <select
                                                    value={data.closeTime || defaultCloseTime}
                                                    onChange={(e) => updateDay(day, { closeTime: e.target.value })}
                                                    className="bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-900 outline-none"
                                                >
                                                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-600">Staff needed</span>
                                                <input
                                                    type="number"
                                                    value={data.staffOverride || ''}
                                                    onChange={(e) => updateDay(day, { staffOverride: parseInt(e.target.value) || undefined })}
                                                    placeholder="Optional"
                                                    className="w-16 bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-900 outline-none text-right"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
