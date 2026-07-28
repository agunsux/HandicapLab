import Link from 'next/link';

export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-bold text-white font-mono uppercase tracking-widest">Account</h1>
        <p className="text-xs text-slate-500 font-mono mt-1">Settings, preferences & research tools</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <span className="text-xs font-mono text-slate-400">Email</span>
              <span className="text-xs font-mono text-white">demo@handicaplab.com</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <span className="text-xs font-mono text-slate-400">Plan</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">Quant</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-mono text-slate-400">Member Since</span>
              <span className="text-xs font-mono text-white">Jan 2026</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest mb-4">Developer Mode</h2>
          <p className="text-xs text-slate-500 font-mono mb-4">
            Access research infrastructure, prediction audit, calibration tools, and model diagnostics.
          </p>
          <Link
            href="/research-lab"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-slate-200 hover:bg-slate-750 hover:text-white transition-colors"
          >
            <span>🔬</span>
            <span className="font-mono">Open Research Lab</span>
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest mb-4">Admin</h2>
          <div className="space-y-2">
            <Link href="/admin" className="block text-xs font-mono text-slate-400 hover:text-white transition-colors">
              → Admin Dashboard
            </Link>
            <Link href="/admin/login" className="block text-xs font-mono text-slate-400 hover:text-white transition-colors">
              → Admin Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}