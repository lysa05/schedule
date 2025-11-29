import React, { useState, useRef, useEffect } from 'react';
import { SpecialDaysCalendar } from './components/SpecialDaysCalendar';
import { StoreConfiguration } from './components/StoreConfiguration';
import { GenerateSection } from './components/GenerateSection';
import { ResultsView } from './components/ResultsView';
import type { SolveResponse, SpecialDayInput, EmployeeInput, SolveRequest } from './types';

// IMPORTANT: Replace with your Render URL after deployment
// const API_URL = "https://scheduler-api-wsfi.onrender.com/solve";
const API_URL = "http://localhost:8000/solve";

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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Progress simulation
  useEffect(() => {
    let interval: any;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          // Slow down as it gets higher
          const step = Math.max(0.5, (90 - prev) / 50);
          return prev + step;
        });
      }, 100);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setShowToast(false);

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
      setShowToast(true);

      // Auto-scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Hide toast after 3 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 3000);

    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-fade-in-down flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Schedule generated. Scroll down to see results.</span>
        </div>
      )}

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

        {/* Progress Bar Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/80 z-40 flex flex-col items-center justify-center">
            <div className="w-64 bg-slate-200 rounded-full h-2.5 mb-4 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-slate-600 font-medium animate-pulse">Generating schedule...</p>
            <p className="text-slate-400 text-sm mt-1">This can take up to a few minutes.</p>
          </div>
        )}

        <GenerateSection
          onGenerate={handleGenerate}
          loading={loading}
          error={error}
        />

        {/* Results */}
        {results && (
          <div ref={resultsRef} className="animate-fade-in pt-4">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Results</h2>
            <ResultsView
              results={results}
              month={month}
              year={year}
              onUpdateResults={setResults}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
