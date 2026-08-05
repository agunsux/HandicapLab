'use client';

import React from 'react';
import { Cpu, Activity, ShieldCheck } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111827] border border-[#1F2937] rounded-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#10B981]" />
            <h1 className="text-xl font-bold text-[#F0FDF4]">Quantitative Models & Ensemble Specs</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-sans">
            Bivariate Poisson, Dixon-Coles low-scoring correction, and Platt scaling calibration engine.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Poisson Weight" value="50.0%" subtitle="Ensemble Weighting" icon={Cpu} />
        <StatCard title="Dixon-Coles Weight" value="50.0%" subtitle="Low Scoring Adjustment (rho = -0.06)" icon={Activity} />
        <StatCard title="Platt Scaling (A, B)" value="1.02, -0.01" subtitle="Probability Calibration Params" icon={ShieldCheck} />
      </div>
    </div>
  );
}
