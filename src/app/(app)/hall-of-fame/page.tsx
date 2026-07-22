'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  AlertOctagon,
  ShieldCheck,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function HallOfFamePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHallData();
  }, []);

  const fetchHallData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public-ledger/hall');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load hall data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg flex justify-between items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-50 tracking-wider">
              HALL OF FAME & HALL OF SHAME
            </h1>
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-0.5 rounded">
              OPEN AUDIT & POSTMORTEMS
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Celebrating our top value wins while opening mandatory public postmortems for our worst model failures. Zero deletion allowed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hall of Fame */}
        <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg space-y-4">
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            HALL OF FAME (TOP VALUE WINS)
          </h3>

          <div className="space-y-3">
            {(data?.hallOfFame || []).map((item: any, idx: number) => (
              <div key={idx} className="bg-[#141A26] border border-slate-800 p-4 rounded space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-100">{item.fixtureName}</span>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">{item.recordType}</span>
                </div>
                <div className="text-slate-400">{item.league} | Bookmaker Odds: {item.bookmakerOdds.toFixed(2)} | EV: +{(item.expectedValue * 100).toFixed(1)}%</div>
                <p className="text-slate-300 text-[11px] leading-relaxed pt-1 border-t border-slate-800">{item.postmortemNotes}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hall of Shame */}
        <div className="border border-slate-800 bg-[#0F131C] p-5 rounded-lg space-y-4">
          <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-rose-400" />
            HALL OF SHAME (MODEL FAILURE POSTMORTEMS)
          </h3>

          <div className="space-y-3">
            {(data?.hallOfShame || []).map((item: any, idx: number) => (
              <div key={idx} className="bg-[#141A26] border border-slate-800 p-4 rounded space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-100">{item.fixtureName}</span>
                  <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[10px]">{item.recordType}</span>
                </div>
                <div className="text-slate-400">{item.league} | Model Prob: {(item.predictedProb * 100).toFixed(1)}% | Outcome: {item.result}</div>
                <p className="text-slate-300 text-[11px] leading-relaxed pt-1 border-t border-slate-800">{item.postmortemNotes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
