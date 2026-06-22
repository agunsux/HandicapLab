import SignalTable from '@/components/SignalTable';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
              </div>
              HandicapLab
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Quantitative signal ledger and analytics engine
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm">
              <span className="text-slate-400 mr-2">System Status:</span>
              <span className="text-emerald-400 font-medium">Online</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Total Signals</h3>
            <p className="text-3xl font-bold text-white">--</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Average ROI</h3>
            <p className="text-3xl font-bold text-emerald-400">--%</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Win Rate</h3>
            <p className="text-3xl font-bold text-white">--%</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Recent Signals</h2>
          <SignalTable />
        </div>
      </div>
    </main>
  );
}
