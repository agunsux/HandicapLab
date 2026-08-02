import React from 'react';

export default function AnalysisPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col min-h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Deep Match Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed breakdown of model projections, Poisson parameters, and calibration metrics.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground">Select a match to view deep analysis.</p>
      </div>
    </div>
  );
}
