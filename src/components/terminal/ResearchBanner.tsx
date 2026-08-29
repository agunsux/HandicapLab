import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function ResearchBanner() {
  return (
    <div className="w-full bg-amber-500/15 border-y md:border border-amber-500/30 md:rounded-xl p-4 my-4 text-amber-200">
      <div className="flex items-start gap-3 max-w-7xl mx-auto">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed">
          <span className="font-bold text-amber-300 mr-2">RESEARCH STATUS:</span>
          <span>
            Model <strong>AH-dixoncoles-v1.0.0</strong> is <strong>NOT VALIDATED</strong>. Historical backtest ROI: <strong>-2.30%</strong>. CLV not statistically significant (p=0.555). All outputs are published strictly for quantitative research transparency, not as betting recommendations.
          </span>
        </div>
      </div>
    </div>
  );
}
