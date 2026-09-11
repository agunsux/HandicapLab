import { getTopLeagues } from '@/lib/data/leagues';
import { CompetitionsList } from './_components/CompetitionsList';
import { StructuredData } from '@/components/StructuredData';

export const revalidate = 3600; // 1-hour ISR revalidation

export const metadata = {
  title: 'Football Competitions & League Statistics | HandicapLab',
  description: 'Explore football league statistics, match data, and team analytics across global competitions. Asian Handicap, Over/Under, and BTTS coverage.',
};

export default async function CompetitionsIndex() {
  const competitions = await getTopLeagues();

  const breadcrumbs = [
    { name: 'Home', item: 'https://handicaplab.dev' },
    { name: 'Competitions', item: 'https://handicaplab.dev/competitions' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-6">
      <StructuredData type="BreadcrumbList" data={breadcrumbs} />
      <StructuredData type="Organization" data={{}} />

      <main className="max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Model Coverage
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Football Competitions Analytics
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Select a league, cup, or international tournament below to explore ensembled probabilities, average goal frequencies, and calculated Asian Handicap value edges.
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-500 bg-slate-900/40 px-4 py-2.5 rounded-lg border border-slate-850 mt-2">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              ✓ Data Verified
            </span>
            <span className="text-slate-800">•</span>
            <span>Last sync: {new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-slate-800">•</span>
            <span>Source: API provider (api-football)</span>
          </div>
        </div>

        <CompetitionsList competitions={competitions} />
      </main>
    </div>
  );
}
