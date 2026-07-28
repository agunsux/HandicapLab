import Link from 'next/link';

const researchSections = [
  {
    title: 'Prediction Audit',
    items: [
      { href: '/audit', label: 'Prediction Audit', desc: 'Full audit trail of all predictions' },
      { href: '/prediction', label: 'Prediction Engine', desc: 'Live prediction serving' },
      { href: '/validation', label: 'Validation Engine', desc: 'Validation & confidence scoring' },
    ],
  },
  {
    title: 'Calibration & Metrics',
    items: [
      { href: '/calibration', label: 'Calibration', desc: 'Model calibration curves' },
      { href: '/performance', label: 'Performance Ledger', desc: 'ROI, yield, CLV tracking' },
      { href: '/clv', label: 'CLV Analysis', desc: 'Closing line value analytics' },
      { href: '/public-ledger', label: 'Public Ledger', desc: 'Transparent prediction records' },
    ],
  },
  {
    title: 'Evidence & Transparency',
    items: [
      { href: '/evidence', label: 'Evidence Center', desc: 'Full evidence collection' },
      { href: '/transparency', label: 'Transparency Hub', desc: 'Verification & trust mechanisms' },
      { href: '/trust-center', label: 'Trust Center', desc: 'Security & verification policy' },
      { href: '/track-record', label: 'Track Record', desc: 'Historical performance metrics' },
    ],
  },
  {
    title: 'Model & Research',
    items: [
      { href: '/research/timeline', label: 'Timeline', desc: 'Model evolution timeline' },
      { href: '/research/hall-of-mistakes', label: 'Hall of Mistakes', desc: 'Failure analysis' },
      { href: '/research/datasets', label: 'Datasets', desc: 'Research datasets' },
      { href: '/research/probability', label: 'Probability', desc: 'Probability distribution analysis' },
      { href: '/research/reports', label: 'Reports', desc: 'Research reports & findings' },
      { href: '/scientific-research', label: 'Scientific Research', desc: 'Academic-grade research' },
    ],
  },
  {
    title: 'Market Intelligence',
    items: [
      { href: '/market-quant', label: 'Market Quant', desc: 'Quantitative market analysis' },
      { href: '/scanner', label: 'Match Scanner', desc: 'Match scanning & edge detection' },
      { href: '/value-bets', label: 'Value Bets', desc: 'Value betting opportunities' },
      { href: '/shadow-mode', label: 'Shadow Mode', desc: 'Shadow pipeline comparison' },
      { href: '/watchlist', label: 'Watchlist', desc: 'User watchlist & tracking' },
    ],
  },
  {
    title: 'History & Data Quality',
    items: [
      { href: '/history', label: 'Historical ROI', desc: 'Historical return analysis' },
      { href: '/data-quality', label: 'Data Quality', desc: 'Data quality metrics & drift' },
      { href: '/research-console', label: 'Research Console', desc: 'Research operations console' },
      { href: '/hall-of-fame', label: 'Hall of Fame', desc: 'Top-performing predictions' },
      { href: '/ledger', label: 'Ledger', desc: 'Ledger records & details' },
    ],
  },
];

export default function ResearchLabPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-lg font-bold text-white font-mono uppercase tracking-widest">🔬 Research Lab</h1>
        <p className="text-xs text-slate-500 font-mono mt-1">
          Research infrastructure, model diagnostics, audit tools, and scientific validation.
          <span className="text-slate-600"> These tools are designed for internal analysis and advanced users.</span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {researchSections.map((section) => (
          <div key={section.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest mb-3">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-200 font-mono">{item.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}