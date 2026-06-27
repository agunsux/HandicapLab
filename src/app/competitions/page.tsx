import { getTopLeagues } from '@/lib/data/leagues';
import { CompetitionsList } from './_components/CompetitionsList';
import { StructuredData } from '@/components/StructuredData';

export const revalidate = 3600; // 1-hour ISR revalidation

export const metadata = {
  title: 'Football Competitions Coverage & Predictive Analytics | HandicapLab',
  description: 'Expose pricing value edges across global football leagues, domestic cups, and international tournaments. View ensembled Dixon-Coles goal expectations.',
};

export default async function CompetitionsIndex() {
  const competitions = await getTopLeagues();

  const breadcrumbs = [
    { name: 'Home', item: 'https://handicap-lab.vercel.app' },
    { name: 'Competitions', item: 'https://handicap-lab.vercel.app/competitions' }
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
        </div>

        <CompetitionsList competitions={competitions} />
      </main>
    </div>
  );
}
