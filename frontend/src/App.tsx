import React, { useState } from 'react';
import { PeriodSelector } from './components/PeriodSelector';
import { SpecialDaysCalendar } from './components/SpecialDaysCalendar';
import { StoreConfiguration } from './components/StoreConfiguration';
import { GenerateSection } from './components/GenerateSection';
import { ResultsView } from './components/ResultsView';
import type { SolveResponse, SpecialDayInput, EmployeeInput, SolveRequest } from './types';

// IMPORTANT: Replace with your Render URL after deployment
const API_URL = "https://scheduler-api-wsfi.onrender.com/solve";

const App: React.FC = () => {
  // State
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [specialDays, setSpecialDays] = useState<SpecialDayInput[]>([]);

  const [fulltimeHours, setFulltimeHours] = useState(184);
  const [employees, setEmployees] = useState<EmployeeInput[]>([
    { id: '1', name: 'Kuba', role: 'manager', contract: 'fulltime', targetHours: 184, unavailableDays: [], vacationDays: [] },
    { id: '2', name: 'Andrii', role: 'deputy', contract: 'fulltime', targetHours: 184, unavailableDays: [], vacationDays: [] },
    { id: '3', name: 'Almaz', role: 'supervisor', contract: 'fulltime', targetHours: 184, unavailableDays: [], vacationDays: [] },
    { id: '4', name: 'Misa', role: 'assistant', contract: '0.5', targetHours: 92, unavailableDays: [], vacationDays: [] },
  ]);
  const [requireManagerMondays, setRequireManagerMondays] = useState(true);

  const [results, setResults] = useState<SolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const payload: SolveRequest = {
        month,
        year,
        fulltimeHours,
        employees,
        specialDays,
        requireManagerMondays
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }

      const data: SolveResponse = await response.json();
      setResults(data);

    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Shift Scheduler</h1>
          <p className="mt-2 text-slate-600">Generate fair and balanced shift plans for your store.</p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          <PeriodSelector
            month={month}
            year={year}
            onChange={(m, y) => { setMonth(m); setYear(y); }}
          />

          <SpecialDaysCalendar
            month={month}
            year={year}
            specialDays={specialDays}
            onChange={setSpecialDays}
          />

          <StoreConfiguration
            fulltimeHours={fulltimeHours}
            setFulltimeHours={setFulltimeHours}
            employees={employees}
            setEmployees={setEmployees}
            requireManagerMondays={requireManagerMondays}
            setRequireManagerMondays={setRequireManagerMondays}
            month={month}
            year={year}
          />

          <GenerateSection
            onGenerate={handleGenerate}
            loading={loading}
            error={error}
          />
        </div>

        {/* Results */}
        {results && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Results</h2>
            <ResultsView results={results} month={month} year={year} />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
