import Link from 'next/link';
import { getTopLeagues } from '@/lib/data/leagues';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StructuredData } from '@/components/StructuredData';

export const revalidate = 3600; // 1-hour ISR revalidation

export const metadata = {
  title: 'Football Leagues Coverage & Predictive Analytics | HandicapLab',
  description: 'Expose pricing value edges across global football leagues. View ensembled Dixon-Coles goal expectations and Asian Handicap models.',
};

export default async function LeaguesIndex() {
  const leagues = await getTopLeagues();

  const breadcrumbs = [
    { name: 'Home', item: 'https://handicap-lab.vercel.app' },
    { name: 'Leagues', item: 'https://handicap-lab.vercel.app/leagues' }
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
            Football Leagues Analytics
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Select a league below to explore ensembled probabilities, average goal frequencies, and calculated Asian Handicap value edges.
          </p>
        </div>

        {/* Grid of Leagues */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues.map((league) => (
            <Card key={league.api_id} className="bg-slate-900 border-slate-800 hover:border-emerald-500/20 transition-all flex flex-col justify-between">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">{league.country}</span>
                  <CardTitle className="text-base font-bold text-white">{league.name}</CardTitle>
                </div>
                {/* Logo wrapper */}
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center p-1.5 shrink-0">
                  <img src={league.logo_url} alt={league.name} className="max-h-full max-w-full object-contain" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-slate-500">Avg Goals: <span className="text-slate-350 font-bold">{league.stats.avgGoals.toFixed(2)}</span></div>
                  <div className="text-slate-500">Over 2.5: <span className="text-slate-350 font-bold">{league.stats.over25Percent}%</span></div>
                  <div className="text-slate-500">BTTS: <span className="text-slate-350 font-bold">{league.stats.bttsPercent}%</span></div>
                  <div className="text-slate-500">Draws: <span className="text-slate-350 font-bold">{league.stats.drawPercent}%</span></div>
                </div>
                <Link href={`/leagues/${league.slug}`} className="block">
                  <button className="w-full py-2 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono transition-colors">
                    Examine Value Edges →
                  </button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
