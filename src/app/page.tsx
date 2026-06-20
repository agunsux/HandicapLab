import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Header / Nav */}
      <header className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg tracking-wider">
            H
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white leading-none text-base">Handicap<span className="text-emerald-400">Lab</span></span>
            <span className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-widest">Market Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-xs font-mono text-slate-400 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard">
            <button className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-white hover:bg-slate-800 transition-colors">
              Access Dashboard
            </button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full px-6 py-20 lg:py-32 space-y-16">
        <div className="max-w-3xl space-y-6 text-left">
          <Badge text="QUANTITATIVE FOOTBALL ANALYTICS" />
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Football Market Analytics & <span className="text-emerald-400">Probability Intelligence</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl font-normal leading-relaxed">
            Eliminate bias. HandicapLab applies Poisson distribution models to calculate mathematically fair odds, mapping them against live bookmaker lines to pinpoint genuine value edges.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/dashboard">
              <button className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm tracking-tight transition-colors shadow-lg shadow-emerald-500/10">
                Launch Value Scanner
              </button>
            </Link>
            <Link href="/pricing">
              <button className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-white border border-slate-800 font-semibold text-sm tracking-tight transition-colors">
                View Pricing Plans
              </button>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-900 p-6 rounded-xl space-y-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm">01</div>
            <h3 className="text-lg font-bold text-white">Asian Handicap Projections</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              We calculate cover probabilities across handicap lines (-0.25, -0.75, +1.0) and identify edges where market odds mismatch model outputs.
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-900 p-6 rounded-xl space-y-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm">02</div>
            <h3 className="text-lg font-bold text-white">Over/Under Total Goals</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Expectation analysis for goal thresholds. Maps historical score sheets to build predictive score counts, avoiding simple averages.
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-900 p-6 rounded-xl space-y-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm">03</div>
            <h3 className="text-lg font-bold text-white">Moneyline Edge & Verification</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              1X2 probabilities derived from Poisson goal expectation matrices. Rigorous model backtesting keeps historical performance fully transparent.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left space-y-2 max-w-xl">
            <div className="text-xs text-slate-500 font-mono">
              © {new Date().getFullYear()} HandicapLab. All rights reserved.
            </div>
            <p className="text-[10px] text-slate-600 leading-normal">
              <strong>Risk Warning:</strong> HandicapLab is a decision-support market analytics platform. We do not provide financial advice or guarantee profits. Football matches involve statistical variance. Users are responsible for their analytical decisions. This is not a gambling platform.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-350">App Dashboard</Link>
            <span>•</span>
            <Link href="/pricing" className="hover:text-slate-350">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sub-component Badge
function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider uppercase">
      {text}
    </span>
  );
}
