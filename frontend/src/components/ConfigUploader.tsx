import React from 'react';

interface ConfigUploaderProps {
    mode: 'default' | 'advanced';
    setMode: (mode: 'default' | 'advanced') => void;
    onFileUpload: (file: File) => void;
    fileName?: string;
}

export const ConfigUploader: React.FC<ConfigUploaderProps> = ({ mode, setMode, onFileUpload, fileName }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Step 3 – Store configuration</h2>
            <p className="text-sm text-slate-500 mb-4">Choose whether to use the default settings or upload a custom configuration file.</p>

            <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                        type="radio"
                        name="configMode"
                        checked={mode === 'default'}
                        onChange={() => setMode('default')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                        <div className="font-medium text-slate-900">Use default store configuration</div>
                        <div className="text-sm text-slate-500">Use the built-in settings for staff and rules.</div>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                        type="radio"
                        name="configMode"
                        checked={mode === 'advanced'}
                        onChange={() => setMode('advanced')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-slate-900">Advanced: upload configuration file (JSON)</div>

                        {mode === 'advanced' && (
                            <div className="mt-2">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
                                    className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                  "
                                />
                                {fileName && <div className="mt-1 text-xs text-green-600">Loaded: {fileName}</div>}
                            </div>
                        )}
                    </div>
                </label>
            </div>
        </div>
    );
};
