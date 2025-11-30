import React, { useState } from 'react';

interface GenerateSectionProps {
    onGenerate: () => void;
    loading: boolean;
    error: string | null;
}

export const GenerateSection: React.FC<GenerateSectionProps> = ({ onGenerate, loading, error }) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
            <button
                onClick={onGenerate}
                disabled={loading}
                className={`
          px-8 py-3 rounded-lg font-medium text-white text-lg shadow-sm transition-all
          ${loading
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md active:transform active:scale-95'}
        `}
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                    </span>
                ) : (
                    "Generate schedule"
                )}
            </button>

            {loading && (
                <p className="mt-3 text-sm text-slate-500 animate-pulse">
                    This may take up to a few minutes.
                </p>
            )}

            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg text-left">
                    <div className="text-red-800 font-medium">We could not generate the schedule. Please try again or contact your administrator.</div>

                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="mt-2 text-xs text-red-600 underline hover:text-red-800"
                    >
                        {showDetails ? "Hide technical details" : "Show technical details"}
                    </button>

                    {showDetails && (
                        <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-900 overflow-auto">
                            {error}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};
