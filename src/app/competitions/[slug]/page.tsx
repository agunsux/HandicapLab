import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLeagueBySlug, getLeagueMatches, STATIC_LEAGUES } from '@/lib/data/leagues';
import { LeagueMatchesTable } from './_components/LeagueMatchesTable';
import { StructuredData } from '@/components/StructuredData';
import { Card, CardContent } from '@/components/ui/card';

export const revalidate = 3600; // 1-hour ISR revalidation

// Pre-render top league paths at build time
export async function generateStaticParams() {
  return STATIC_LEAGUES.map((league) => ({
    slug: league.slug,
  }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  
  if (!league) {
    return {
      title: 'Competition Not Found | HandicapLab',
    };
  }

  return {
    title: `${league.name} Quant Analytics & Value Edges | HandicapLab`,
    description: `Access Dixon-Coles goal expectations and Asian Handicap edges for ${league.name}. Compare fair probabilities with market pricing.`,
    alternates: {
      canonical: `https://handicap-lab.vercel.app/competitions/${slug}`,
    },
    openGraph: {
      title: `${league.name} Predictive Model Analytics | HandicapLab`,
      description: `Mathematical betting market edges for ${league.name} matches. Powered by ensembled Poisson simulations.`,
      url: `https://handicap-lab.vercel.app/competitions/${slug}`,
      type: 'website',
    }
  };
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);

  if (!league) {
    notFound();
  }

  const matches = await getLeagueMatches(league.api_id, slug);

  // Generate structured data
  const breadcrumbs = [
    { name: 'Home', item: 'https://handicap-lab.vercel.app' },
    { name: 'Competitions', item: 'https://handicap-lab.vercel.app/competitions' },
    { name: league.name, item: `https://handicap-lab.vercel.app/competitions/${slug}` }
  ];

  const faqs = [
    {
      q: `What is the average goal rate in the ${league.name}?`,
      a: `According to our quant model's current dataset, the average goal frequency is ${league.stats.avgGoals.toFixed(2)} goals per match, with BTTS occurring in ${league.stats.bttsPercent}% of fixtures.`
    },
    {
      q: `How are the value edges calculated for ${league.name} matches?`,
      a: `Value edges are computed by running 10,000 Dixon-Coles and Double Poisson simulations using team xG splits. We then convert these probabilities into fair decimal odds and compare them to live market pricing.`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-6">
      <StructuredData type="BreadcrumbList" data={breadcrumbs} />
      <StructuredData type="FAQPage" data={faqs} />
      <StructuredData type="Organization" data={{}} />

      <main className="max-w-5xl mx-auto space-y-12">
        {/* Header/Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-850">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-3">
              <img src={league.logo_url} alt={league.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">{league.region}</span>
                <span className="text-[10px] bg-slate-900 text-slate-500 font-mono px-1.5 py-0.5 rounded border border-slate-800 uppercase">
                  {league.competition_type}
                </span>
                <span className="text-[10px] bg-slate-900 text-slate-500 font-mono px-1.5 py-0.5 rounded border border-slate-800">
                  Season {league.season}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
                {league.name} Analysis
              </h1>
            </div>
          </div>

          <Link href="/competitions">
            <button className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white border border-slate-800 transition-colors font-mono text-xs">
              ← Back to Competitions
            </button>
          </Link>
        </div>

        {/* Quant Performance Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Avg Goals</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">{league.stats.avgGoals.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Over 2.5 %</span>
              <div className="text-2xl font-bold font-mono text-white">{league.stats.over25Percent}%</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">BTTS %</span>
              <div className="text-2xl font-bold font-mono text-white">{league.stats.bttsPercent}%</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Home Wins %</span>
              <div className="text-2xl font-bold font-mono text-slate-300">{league.stats.homeWinPercent}%</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800/80 col-span-2 lg:col-span-1">
            <CardContent className="p-4 space-y-1 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Away Wins / Draws</span>
              <div className="text-xl font-bold font-mono text-slate-350">
                {league.stats.awayWinPercent}% / {league.stats.drawPercent}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fixtures Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Mathematical Predictions</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Computed value edges matching Dixon-Coles goal expectation versus live market lines.
              </p>
            </div>
          </div>
          <LeagueMatchesTable matches={matches} />
        </div>

        {/* FAQ Section (Accordion/Card format) */}
        <div className="space-y-6 pt-6 border-t border-slate-850">
          <h3 className="text-lg font-bold text-white font-mono">Competition Predictive Intelligence FAQ</h3>
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
