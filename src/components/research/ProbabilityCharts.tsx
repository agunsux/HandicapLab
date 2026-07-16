import React from 'react';

export const ProbabilityCharts: React.FC = () => {
  // Mock data for calibration
  const calibrationData = [
    { bucket: '0.1-0.2', predicted: 0.15, actual: 0.13 },
    { bucket: '0.2-0.3', predicted: 0.25, actual: 0.22 },
    { bucket: '0.3-0.4', predicted: 0.35, actual: 0.38 },
    { bucket: '0.4-0.5', predicted: 0.45, actual: 0.46 },
    { bucket: '0.5-0.6', predicted: 0.55, actual: 0.56 },
    { bucket: '0.6-0.7', predicted: 0.65, actual: 0.61 },
    { bucket: '0.7-0.8', predicted: 0.75, actual: 0.73 },
  ];

  // Mock data for season performance (Brier Score)
  const seasonData = [
    { season: '15/16', brier: 0.189 },
    { season: '16/17', brier: 0.185 },
    { season: '17/18', brier: 0.182 },
    { season: '18/19', brier: 0.181 },
    { season: '19/20', brier: 0.180 },
    { season: '20/21', brier: 0.184 },
    { season: '21/22', brier: 0.179 },
    { season: '22/23', brier: 0.175 },
    { season: '23/24', brier: 0.178 },
  ];

  return (
    <div className="space-y-8">
      {/* Calibration Chart */}
      <div>
        <h4 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Calibration (Expected vs Actual Win Rate)</h4>
        <div className="flex items-end space-x-2 h-48 border-b border-l border-slate-700 p-4">
          {calibrationData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end items-center space-y-1 group relative">
              {/* Actual bar */}
              <div 
                className="w-full bg-blue-500 opacity-80 rounded-t"
                style={{ height: `${d.actual * 100}%` }}
              ></div>
              {/* Predicted line overlay (simulated by a small horizontal bar) */}
              <div 
                className="absolute w-full bg-emerald-400 h-1 z-10"
                style={{ bottom: `${d.predicted * 100}%` }}
              ></div>
              
              {/* Tooltip */}
              <div className="hidden group-hover:block absolute -top-12 bg-slate-800 text-xs p-2 rounded shadow-lg whitespace-nowrap z-20">
                <p>Predicted: {(d.predicted * 100).toFixed(1)}%</p>
                <p>Actual: {(d.actual * 100).toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500 px-4">
          {calibrationData.map((d, i) => (
            <div key={i} className="flex-1 text-center">{d.bucket}</div>
          ))}
        </div>
        <div className="flex justify-center items-center space-x-4 mt-4 text-xs text-slate-400">
          <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 opacity-80 mr-2 rounded"></div>Actual Win Rate</div>
          <div className="flex items-center"><div className="w-3 h-1 bg-emerald-400 mr-2 rounded"></div>Expected (Predicted)</div>
        </div>
      </div>

      {/* Season Performance Chart */}
      <div>
        <h4 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Brier Score per Season (Lower is Better)</h4>
        <div className="flex items-end space-x-2 h-32 border-b border-slate-700">
          {seasonData.map((d, i) => {
            // Normalize height between a sensible range for visualization (0.17 to 0.20)
            const minBrier = 0.170;
            const maxBrier = 0.200;
            const normalizedHeight = Math.max(0, Math.min(100, ((d.brier - minBrier) / (maxBrier - minBrier)) * 100));

            return (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                <div 
                  className="w-full bg-emerald-600/50 hover:bg-emerald-500 transition-colors rounded-t"
                  style={{ height: `${normalizedHeight}%` }}
                ></div>
                
                <div className="hidden group-hover:block absolute -top-8 bg-slate-800 text-xs p-2 rounded shadow-lg z-20">
                  {d.brier.toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          {seasonData.map((d, i) => (
            <div key={i} className="flex-1 text-center truncate px-1">{d.season}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
