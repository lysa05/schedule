import React, { useState } from 'react';
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
  const [year] = useState(new Date().getFullYear());

  const [specialDays, setSpecialDays] = useState<SpecialDayInput[]>([]);
  const [defaultOpenTime, setDefaultOpenTime] = useState("08:30");
  const [defaultCloseTime, setDefaultCloseTime] = useState("21:00");

  const [fulltimeHours, setFulltimeHours] = useState(184);
  const [employees, setEmployees] = useState<EmployeeInput[]>([
    { id: '1', name: 'Kuba', role: 'manager', contractFte: 1.0, unavailableDays: [], vacationDays: [] },
    { id: '2', name: 'Andrii', role: 'deputy', contractFte: 1.0, unavailableDays: [], vacationDays: [] },
    { id: '3', name: 'Almaz', role: 'supervisor', contractFte: 1.0, unavailableDays: [], vacationDays: [] },
    { id: '4', name: 'Misa', role: 'assistant', contractFte: 0.5, unavailableDays: [], vacationDays: [] },
  ]);

  const [config, setConfig] = useState({
    autoStaffing: true,
    busyWeekends: true
  });

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
        defaultOpenTime,
        defaultCloseTime,
        employees,
        specialDays,
        config
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
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shift Scheduler</h1>
        </div>

        {/* Steps */}
        <SpecialDaysCalendar
          month={month}
          year={year}
          setMonth={setMonth}
          specialDays={specialDays}
          onChange={setSpecialDays}
          defaultOpenTime={defaultOpenTime}
          setDefaultOpenTime={setDefaultOpenTime}
          defaultCloseTime={defaultCloseTime}
          setDefaultCloseTime={setDefaultCloseTime}
        />

        <StoreConfiguration
          fulltimeHours={fulltimeHours}
          setFulltimeHours={setFulltimeHours}
          employees={employees}
          setEmployees={setEmployees}
          config={config}
          setConfig={setConfig}
          month={month}
          year={year}
        />

        <GenerateSection
          onGenerate={handleGenerate}
          loading={loading}
          error={error}
        />

        {/* Results */}
        {results && (
          <div className="animate-fade-in pt-4">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Results</h2>
            <ResultsView results={results} month={month} year={year} />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
