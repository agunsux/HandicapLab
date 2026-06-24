import Link from 'next/link';
import { getAllTeams } from '@/lib/data/teams';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StructuredData } from '@/components/StructuredData';

export const revalidate = 3600; // 1-hour ISR revalidation

export const metadata = {
  title: 'Football Teams Statistical Form & xG Profiles | HandicapLab',
  description: 'View detailed quantitative analytics profiles for global football clubs. Analyze Dixon-Coles expected goals (xG) form splits.',
};

export default async function TeamsIndex() {
  const teams = await getAllTeams();

  const breadcrumbs = [
    { name: 'Home', item: 'https://handicap-lab.vercel.app' },
    { name: 'Teams', item: 'https://handicap-lab.vercel.app/teams' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-6">
      <StructuredData type="BreadcrumbList" data={breadcrumbs} />
      <StructuredData type="Organization" data={{}} />

      <main className="max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Team Profiles
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Football Teams Intelligence
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Explore advanced club profiles with ensembled Dixon-Coles xG home/away splits, goal volumes, and recent form indicators.
          </p>
        </div>

        {/* Grid of Teams */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {teams.map((team) => (
            <Card key={team.api_id} className="bg-slate-900 border-slate-800 hover:border-emerald-500/20 transition-all flex flex-col justify-between">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-bold text-white leading-tight">{team.name}</CardTitle>
                </div>
                {/* Logo wrapper */}
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center p-1.5 shrink-0">
                  <img src={team.logo_url} alt={team.name} className="max-h-full max-w-full object-contain" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-slate-500 col-span-2 flex justify-between">
                    <span>Recent Form:</span>
                    <span className="flex gap-0.5">
                      {team.form.map((r, idx) => (
                        <span
                          key={idx}
                          className={`w-3.5 h-3.5 inline-flex items-center justify-center rounded-[2px] font-bold text-[9px] text-slate-950 ${
                            r === 'W' ? 'bg-emerald-400' : r === 'D' ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="text-slate-500 pt-1">xG Home: <span className="text-slate-300 font-bold">{team.stats.xgHome.toFixed(2)}</span></div>
                  <div className="text-slate-500 pt-1">xG Away: <span className="text-slate-300 font-bold">{team.stats.xgAway.toFixed(2)}</span></div>
                  <div className="text-slate-500">Scored: <span className="text-slate-300 font-bold">{team.stats.goalsScored}</span></div>
                  <div className="text-slate-500">Clean Sh: <span className="text-slate-300 font-bold">{team.stats.cleanSheets}</span></div>
                </div>
                <Link href={`/teams/${team.slug}`} className="block">
                  <button className="w-full py-2 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono transition-colors">
                    Analyze Profile →
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
