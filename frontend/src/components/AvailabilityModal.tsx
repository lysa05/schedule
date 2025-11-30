import React from 'react';

interface AvailabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeName: string;
    month: number;
    year: number;
    unavailableDays: number[];
    vacationDays: number[];
    onSave: (unavailable: number[], vacation: number[]) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
    isOpen, onClose, employeeName, month, year, unavailableDays, vacationDays, onSave
}) => {
    if (!isOpen) return null;

    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    // Calculate offset for the first day of the month (Monday = 0, Sunday = 6)
    const firstDayWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const emptyDays = Array.from({ length: firstDayWeekday }, (_, i) => i);

    const toggleDay = (day: number, type: 'unavailable' | 'vacation') => {
        let newUnavailable = [...unavailableDays];
        let newVacation = [...vacationDays];

        if (type === 'unavailable') {
            if (newUnavailable.includes(day)) {
                newUnavailable = newUnavailable.filter(d => d !== day);
            } else {
                newUnavailable.push(day);
                newVacation = newVacation.filter(d => d !== day); // Mutually exclusive
            }
        } else {
            if (newVacation.includes(day)) {
                newVacation = newVacation.filter(d => d !== day);
            } else {
                newVacation.push(day);
                newUnavailable = newUnavailable.filter(d => d !== day); // Mutually exclusive
            }
        }
        onSave(newUnavailable, newVacation);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900">Edit availability for {employeeName}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {/* Empty Placeholders */}
                        {emptyDays.map(i => (
                            <div key={`empty-${i}`} className="border border-slate-100 rounded-lg p-2 bg-slate-50/50"></div>
                        ))}

                        {days.map(day => {
                            const isUnavailable = unavailableDays.includes(day);
                            const isVacation = vacationDays.includes(day);

                            return (
                                <div key={day} className="border border-slate-200 rounded-lg p-2 flex flex-col gap-2">
                                    <div className="text-center">
                                        <span className="block font-semibold text-slate-900">{day}</span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => toggleDay(day, 'unavailable')}
                                            className={`text-[10px] py-1 px-2 rounded transition-colors ${isUnavailable ? 'bg-red-100 text-red-700 font-medium' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                                        >
                                            OFF
                                        </button>
                                        <button
                                            onClick={() => toggleDay(day, 'vacation')}
                                            className={`text-[10px] py-1 px-2 rounded transition-colors ${isVacation ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                                        >
                                            VAC
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
