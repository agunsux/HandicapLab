import React from 'react';

interface SignalLifecycleProps {
  auditEvents: Array<{ event_type: string; created_at: string }>;
  status: string;
}

export function SignalLifecycle({ auditEvents, status }: SignalLifecycleProps) {
  const lifecycleSteps = [
    { key: 'SIGNAL_CREATED', label: 'Created' },
    { key: 'ODDS_CAPTURED', label: 'Odds Captured' },
    { key: 'LINE_MOVED', label: 'Line Moved' },
    { key: 'SIGNAL_LOCKED', label: 'Locked' },
    { key: 'SIGNAL_SETTLED', label: 'Settled' }
  ];

  // Helper to check if step occurred
  const getStepStatus = (key: string) => {
    const exists = auditEvents?.some(e => e.event_type === key);
    if (exists) return 'completed';
    
    const lowerStatus = (status || '').toLowerCase();
    if (key === 'SIGNAL_SETTLED' && ['won', 'lost', 'void', 'half_win', 'half_loss', 'settled'].includes(lowerStatus)) {
      return 'completed';
    }
    if (key === 'SIGNAL_LOCKED' && lowerStatus === 'locked') {
      return 'completed';
    }
    return 'pending';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">
        Verified Signal Lifecycle
      </h3>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2">
        {lifecycleSteps.map((step, idx) => {
          const stepStatus = getStepStatus(step.key);
          const isCompleted = stepStatus === 'completed';
          
          return (
            <React.Fragment key={step.key}>
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs ${
                  isCompleted ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}>
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-semibold ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                  {isCompleted && (
                    <span className="text-xxs text-emerald-500 font-mono">Verified</span>
                  )}
                </div>
              </div>
              {idx < lifecycleSteps.length - 1 && (
                <div className="hidden md:block flex-1 h-0.5 bg-slate-850 mx-2"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
