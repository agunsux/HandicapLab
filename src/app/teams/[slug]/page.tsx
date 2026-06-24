import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTeamBySlug, getTeamMatches, STATIC_TEAMS } from '@/lib/data/teams';
import { TeamMatchesTable } from './_components/TeamMatchesTable';
import { StructuredData } from '@/components/StructuredData';
import { Card, CardContent } from '@/components/ui/card';

export const revalidate = 3600; // 1-hour ISR revalidation

// Pre-render top team paths at build time
export async function generateStaticParams() {
  return STATIC_TEAMS.map((team) => ({
    slug: team.slug,
  }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);

  if (!team) {
    return {
      title: 'Team Not Found | HandicapLab',
    };
  }

  return {
    title: `${team.name} Football xG splits & Predictions | HandicapLab`,
    description: `Analyze ${team.name}'s ensembled Dixon-Coles goal expectations, xG splits, and calculated Asian Handicap value edges.`,
    alternates: {
      canonical: `https://handicap-lab.vercel.app/teams/${slug}`,
    },
    openGraph: {
      title: `${team.name} Quantitative Analytics Profile | HandicapLab`,
      description: `Mathematical goal expectation models and market opportunities for ${team.name}.`,
      url: `https://handicap-lab.vercel.app/teams/${slug}`,
      type: 'website',
    }
  };
}

export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  const matches = await getTeamMatches(team.api_id, slug);

  // Generate structured data
  const breadcrumbs = [
    { name: 'Home', item: 'https://handicap-lab.vercel.app' },
    { name: 'Teams', item: 'https://handicap-lab.vercel.app/teams' },
    { name: team.name, item: `https://handicap-lab.vercel.app/teams/${slug}` }
  ];

  const faqs = [
    {
      q: `What is the expected goals (xG) split for ${team.name}?`,
      a: `${team.name} currently holds an estimated ensembled xG of ${team.stats.xgHome.toFixed(2)} when playing at home, and ${team.stats.xgAway.toFixed(2)} when playing away.`
    },
    {
      q: `How does HandicapLab predict ${team.name} matches?`,
      a: `Our modeling suite runs 10,000 simulations per match utilizing Dixon-Coles and Double Poisson distributions calibrated with the team's historical goals scored (${team.stats.goalsScored}) and clean sheet rate (${team.stats.cleanSheets} clean sheets).`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-6">
      <StructuredData type="BreadcrumbList" data={breadcrumbs} />
      <StructuredData type="FAQPage" data={faqs} />
      <StructuredData type="Organization" data={{}} />

      {matches.length > 0 && (
        <StructuredData
          type="SportsEvent"
          data={{
            name: `${matches[0].homeTeamName} vs ${matches[0].awayTeamName}`,
            startDate: matches[0].kickoffTime,
            homeTeam: matches[0].homeTeamName,
            awayTeam: matches[0].awayTeamName,
          }}
        />
      )}

      <main className="max-w-5xl mx-auto space-y-12">
        {/* Header/Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-850">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-3">
              <img src={team.logo_url} alt={team.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Club Intelligence</span>
                <span className="flex gap-1 items-center ml-2">
                  {team.form.map((res, i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 inline-flex items-center justify-center rounded-[2px] font-bold text-[9px] text-slate-950 ${
                        res === 'W' ? 'bg-emerald-400' : res === 'D' ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                    >
                      {res}
                    </span>
                  ))}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
                {team.name} Analytics
              </h1>
            </div>
          </div>

          <Link href="/teams">
            <button className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white border border-slate-800 transition-colors font-mono text-xs">
              ← Back to Directories
            </button>
          </Link>
        </div>

        {/* Quant Performance Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Home xG Expectation</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">{team.stats.xgHome.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Away xG Expectation</span>
              <div className="text-2xl font-bold font-mono text-white">{team.stats.xgAway.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Goals Scored</span>
              <div className="text-2xl font-bold font-mono text-slate-300">{team.stats.goalsScored}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Clean Sheets</span>
              <div className="text-2xl font-bold font-mono text-slate-300">{team.stats.cleanSheets}</div>
            </CardContent>
          </Card>
        </div>

        {/* Fixtures Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Upcoming Club Fixtures</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Predicted goal probabilities, Asian Handicap lines, and calculated model edges.
            </p>
          </div>
          <TeamMatchesTable matches={matches} currentTeamName={team.name} />
        </div>

        {/* FAQ Section */}
        <div className="space-y-6 pt-6 border-t border-slate-850">
          <h3 className="text-lg font-bold text-white font-mono">{team.name} Predictive Intelligence FAQ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-900/50 border border-slate-800/60 p-5 rounded-xl space-y-2">
                <h4 className="text-sm font-semibold text-emerald-400 font-sans">{faq.q}</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
