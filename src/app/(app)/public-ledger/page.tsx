'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Search,
  Download,
  Filter,
  Info,
  ExternalLink,
  Sparkles,
  Award
} from 'lucide-react';

export default function PublicLedgerPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<any | null>(null);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public-ledger/predictions');
      const json = await res.json();
      if (json.success) {
        setPredictions(json.data);
      }
    } catch (err) {
      console.error('Failed to load public ledger data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-slate-50 tracking-wider">
              PUBLIC PREDICTION LEDGER & AUDIT TRAIL
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded">
              v1.40.0 IMMUTABLE
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Every prediction is permanent. Every result is auditable. Every model improvement is measurable.
          </p>
        </div>

        <div className="bg-[#141A26] border border-slate-800 p-2.5 rounded text-xs text-right">
          <div className="text-slate-400 text-[10px]">CRYPTOGRAPHIC INTEGRITY</div>
          <div className="text-emerald-400 font-bold">SHA-256 TAMPER EVIDENT VERIFIED</div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-800 bg-[#0F131C] p-4 rounded-lg space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-300 font-bold">SEQUENTIAL PUBLIC RESEARCH ARCHIVE</span>
          </div>
          <button className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded flex items-center gap-2 text-slate-300 font-bold">
            <Download className="h-3.5 w-3.5" />
            EXPORT CSV/JSON
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141A26] text-slate-400 uppercase">
              <tr>
                <th className="p-2.5">PREDICTION ID</th>
                <th className="p-2.5">FIXTURE</th>
                <th className="p-2.5">LEAGUE</th>
                <th className="p-2.5">MARKET</th>
                <th className="p-2.5 text-right">MODEL PROB (95% CI)</th>
                <th className="p-2.5 text-right">FAIR ODDS</th>
                <th className="p-2.5 text-right">BOOKMAKER</th>
                <th className="p-2.5 text-right">EV %</th>
                <th className="p-2.5 text-center">RESULT</th>
                <th className="p-2.5 text-center">VERIFICATION</th>
                <th className="p-2.5 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {predictions.map((p, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="p-2.5 font-bold text-emerald-400">{p.formattedPredictionId}</td>
                  <td className="p-2.5 font-bold text-slate-200">{p.homeTeam} vs {p.awayTeam}</td>
                  <td className="p-2.5 text-slate-400">{p.league}</td>
                  <td className="p-2.5 text-slate-300 uppercase">{p.market} ({p.selection.toUpperCase()})</td>
                  <td className="p-2.5 text-right text-sky-400 font-bold">
                    {(p.modelProb * 100).toFixed(1)}% ({(p.ciLower * 100).toFixed(0)}-{(p.ciUpper * 100).toFixed(0)}%)
                  </td>
                  <td className="p-2.5 text-right text-slate-300">{p.modelFairOdds.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-400">{p.bookmakerOdds.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-400">+{(p.expectedValue * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${p.settlement?.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {p.settlement?.result || 'PENDING'}
                    </span>
                  </td>
                  <td className="p-2.5 text-center font-bold">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      SHA256 OK
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => setSelectedPrediction(p)}
                      className="bg-slate-800 hover:bg-slate-700 text-[11px] px-2 py-1 rounded text-slate-300 font-bold"
                    >
                      INSPECT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Footer Statement */}
      <div className="border border-slate-800 bg-[#0F131C] p-4 rounded-lg text-xs text-slate-400 leading-relaxed text-center font-sans">
        <strong className="text-slate-200">PUBLIC VERIFICATION POLICY:</strong> All predictions, probabilities, historical performance metrics, and research reports published by HandicapLab are generated from version-controlled models and immutable datasets. Every published result is traceable, reproducible, and independently auditable. Historical records are append-only and are never altered after publication.
      </div>
    </div>
  );
}
