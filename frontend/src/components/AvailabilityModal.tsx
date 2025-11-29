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

export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
    isOpen, onClose, employeeName, month, year, unavailableDays, vacationDays, onSave
}) => {
    if (!isOpen) return null;

    const numDays = new Date(year, month, 0).getDate();
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    const toggleDay = (day: number, type: 'unavailable' | 'vacation') => {
        let newUnavailable = [...unavailableDays];
        let newVacation = [...vacationDays];

        // Remove from both first
        newUnavailable = newUnavailable.filter(d => d !== day);
        newVacation = newVacation.filter(d => d !== day);

        // Add if it wasn't already set to this type
        if (type === 'unavailable' && !unavailableDays.includes(day)) {
            newUnavailable.push(day);
        } else if (type === 'vacation' && !vacationDays.includes(day)) {
            newVacation.push(day);
        }

        onSave(newUnavailable, newVacation);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-900">Availability – {employeeName}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-sm text-slate-500 mb-4">Mark days when this employee cannot work or is on vacation.</p>

                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {days.map(day => {
                            const isUnavailable = unavailableDays.includes(day);
                            const isVacation = vacationDays.includes(day);

                            return (
                                <div key={day} className="border border-slate-200 rounded-lg p-2 flex flex-col gap-2 bg-slate-50">
                                    <div className="text-center font-medium text-slate-700 text-sm">{day}</div>
                                    <button
                                        onClick={() => toggleDay(day, 'unavailable')}
                                        className={`text-[10px] py-1 px-2 rounded transition-colors ${isUnavailable ? 'bg-red-100 text-red-700 font-medium' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                                    >
                                        Unavailable
                                    </button>
                                    <button
                                        onClick={() => toggleDay(day, 'vacation')}
                                        className={`text-[10px] py-1 px-2 rounded transition-colors ${isVacation ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                                    >
                                        Vacation
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
