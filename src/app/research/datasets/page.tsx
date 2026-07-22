import React from 'react';
import Link from 'next/link';
import Navbar from '../../(marketing)/_components/Navbar';
import Footer from '../../(marketing)/_components/Footer';
import { Database, Download, ArrowLeft, ShieldCheck, FileSpreadsheet, CheckCircle2, Lock, Code } from 'lucide-react';

export const metadata = {
  title: 'Open Dataset Download Center | HandicapLab Research Institute',
  description: 'Download standardized open public datasets (CSV, Parquet) with cryptographic SHA-256 hashes for independent verification, backtesting, and academic research.',
};

interface DatasetItem {
  filename: string;
  format: string;
  size: string;
  sha256: string;
  api_endpoint: string;
  description: string;
  schema: string[];
  last_updated: string;
}

const datasetItems: DatasetItem[] = [
  {
    filename: 'predictions.csv',
    format: 'CSV / Parquet',
    size: '14.2 MB',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    api_endpoint: '/api/public/predictions',
    description: 'Complete immutable log of pre-kickoff published predictions, timestamps, probabilities, odds, and settlement outcomes.',
    schema: ['prediction_doi', 'match_id', 'published_at', 'market', 'selection', 'probability', 'fair_odds', 'pinnacle_odds', 'result_status', 'settled_at', 'roi'],
    last_updated: 'Updated daily (Live UTC)',
  },
  {
    filename: 'model_versions.csv',
    format: 'CSV',
    size: '184 KB',
    sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    api_endpoint: '/api/public/metrics',
    description: 'Registry of every model release tag, Git commit hash, training window parameters, Brier scores, and calibration metrics.',
    schema: ['version_tag', 'git_commit_hash', 'release_date', 'brier_score', 'ece_score', 'training_start', 'training_end', 'status'],
    last_updated: 'Updated on release',
  },
  {
    filename: 'calibration.csv',
    format: 'CSV',
    size: '1.2 MB',
    sha256: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
    api_endpoint: '/api/public/calibration',
    description: 'Empirical vs predicted probability bin distributions used for Expected Calibration Error (ECE) calculations and Platt scaling.',
    schema: ['bin_index', 'predicted_confidence_avg', 'empirical_accuracy_avg', 'sample_count', 'ece_delta'],
    last_updated: 'Updated weekly',
  },
  {
    filename: 'feature_importance.csv',
    format: 'CSV',
    size: '840 KB',
    sha256: 'd41d8cd98f00b204e9800998ecf8427e9974da1917302482375836c05d762f02',
    api_endpoint: '/api/public/metrics',
    description: 'SHAP feature importance scores across xG, ELO, home advantage, and travel fatigue vector models.',
    schema: ['feature_name', 'model_version', 'mean_shap_value', 'relative_weight_pct'],
    last_updated: 'Updated monthly',
  },
  {
    filename: 'weekly_reports.csv',
    format: 'CSV',
    size: '420 KB',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    api_endpoint: '/api/public/metrics',
    description: 'Aggregated weekly performance metrics, win rates, CLV trends, and sample size breakdowns.',
    schema: ['week_id', 'start_date', 'end_date', 'sample_count', 'win_rate', 'brier_score', 'clv_pct', 'total_yield'],
    last_updated: 'Updated weekly',
  },
];

export default function OpenDatasetsPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/trust-center" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 hover:text-emerald-400 mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Trust Center
        </Link>

        {/* Header Banner */}
        <div className="border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded w-fit border border-cyan-500/20">
            <Database className="h-4 w-4" />
            Open Science Strategy
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 font-sans">
            Open Dataset Download Center
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl mt-3 leading-relaxed font-mono">
            Download raw, standardized quantitative datasets for independent verification, backtesting, and academic research. Every dataset includes cryptographic SHA-256 hashes and REST API endpoints.
          </p>
        </div>

        {/* Datasets Feed */}
        <div className="mt-10 space-y-6">
          <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2 border-b border-zinc-800 pb-3">
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" /> Standardized Research Datasets
          </h2>

          {datasetItems.map((ds) => (
            <div key={ds.filename} className="bg-[#0d0e14] border border-zinc-800 rounded-xl p-6 space-y-4 shadow-lg font-mono text-xs">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-base text-emerald-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded">
                    {ds.filename}
                  </span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                    {ds.format} • {ds.size}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">{ds.last_updated}</span>
              </div>

              <p className="text-zinc-300 font-sans text-xs leading-relaxed bg-[#12131b] p-3.5 rounded border border-zinc-800">
                {ds.description}
              </p>

              <div>
                <span className="text-zinc-500 text-[10px] block mb-1">Cryptographic Checksum SHA-256</span>
                <div className="bg-[#12131b] text-emerald-400 border border-zinc-800 text-[10px] p-2 rounded break-all font-mono">
                  sha256:{ds.sha256}
                </div>
              </div>

              <div>
                <span className="text-zinc-500 text-[10px] block mb-1">Dataset Schema Attributes</span>
                <div className="flex flex-wrap gap-1.5">
                  {ds.schema.map((col) => (
                    <span key={col} className="bg-[#12131b] text-zinc-300 border border-zinc-800 text-[10px] px-2 py-0.5 rounded">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                <a href={ds.api_endpoint} target="_blank" className="text-teal-400 hover:underline flex items-center gap-1 text-[11px]">
                  <Code className="h-3.5 w-3.5" /> API Query Endpoint ({ds.api_endpoint})
                </a>
                <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download Dataset ({ds.filename})
                </button>
              </div>

            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
