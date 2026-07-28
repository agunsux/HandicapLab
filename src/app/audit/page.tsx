import React from 'react';
import SummaryHeader from '@/components/audit/SummaryHeader';
import FilterSection from '@/components/audit/FilterSection';
import PredictionTable from '@/components/audit/PredictionTable';
import HistoricalCharts from '@/components/audit/HistoricalCharts';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prediction Audit Center | HandicapLab',
  description: 'Forensic Investigation Tool for HandicapLab quantitative predictions.',
};

export default function AuditCenterPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Prediction Audit Center
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Forensic investigation tool for model predictions. Every prediction must be explainable, reproducible, and auditable.
        </p>
      </div>

      <SummaryHeader />

      <HistoricalCharts />

      <FilterSection />

      <PredictionTable searchParams={searchParams} />
    </div>
  );
}
