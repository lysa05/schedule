import React, { useState, useEffect } from 'react';
import { PeriodSelector } from './components/PeriodSelector';
import { SpecialDaysCalendar } from './components/SpecialDaysCalendar';
import { ConfigUploader } from './components/ConfigUploader';
import { GenerateSection } from './components/GenerateSection';
import { ResultsView } from './components/ResultsView';
import type { SolveResponse, SpecialDayType } from './types';

// IMPORTANT: Replace with your Render URL after deployment
const API_URL = "https://scheduler-api-wsfi.onrender.com/solve";

const App: React.FC = () => {
  // State
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [specialDays, setSpecialDays] = useState<Map<number, SpecialDayType>>(new Map());

  const [configMode, setConfigMode] = useState<'default' | 'advanced'>('default');
  const [customConfig, setCustomConfig] = useState<any>(null);
  const [defaultConfig, setDefaultConfig] = useState<any>(null);
  const [fileName, setFileName] = useState<string>("");

  const [results, setResults] = useState<SolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load default config on mount
  useEffect(() => {
    fetch('default_config.json')
      .then(res => res.json())
      .then(data => setDefaultConfig(data))
      .catch(err => console.error("Failed to load default config", err));
  }, []);

  // Handlers
  const handleToggleDay = (day: number, type: SpecialDayType) => {
    const newMap = new Map(specialDays);
    if (type === null) {
      newMap.delete(day);
    } else {
      newMap.set(day, type);
    }
    setSpecialDays(newMap);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setCustomConfig(json);
        setFileName(file.name);
        setError(null);
      } catch (err) {
        setError("Could not read the file. Please make sure it is a valid JSON configuration.");
      }
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // 1. Prepare Base Data
      let payload = configMode === 'default' ? { ...defaultConfig } : { ...customConfig };

      if (!payload) {
        throw new Error("Configuration not loaded yet.");
      }

      // 2. Override with User Selections
      payload.year = year;
      payload.month = month;

      // Construct special days / heavy days
      // We need to merge with existing or create new
      const heavy_days = payload.heavy_days || {};
      const closed_holidays = new Set(payload.closed_holidays || []);

      // Clear existing heavy days for this month if we assume UI is source of truth?
      // Or just merge? Let's merge/overwrite based on UI.

      specialDays.forEach((type, day) => {
        const dayStr = day.toString();
        if (type === 'holiday') {
          closed_holidays.add(day);
        } else if (type === 'busy') {
          // Add to heavy days
          heavy_days[dayStr] = { extra_staff: 2 }; // Default extra staff for busy days
        }
      });

      payload.heavy_days = heavy_days;
      payload.closed_holidays = Array.from(closed_holidays);

      // 3. Send Request
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
      <div className="max-w-4xl mx-auto space-y-8">
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
            onToggleDay={handleToggleDay}
          />

          <ConfigUploader
            mode={configMode}
            setMode={setConfigMode}
            onFileUpload={handleFileUpload}
            fileName={fileName}
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
