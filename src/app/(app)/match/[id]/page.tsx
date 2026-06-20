import { getMatchById, getPredictionsForMatch, getTeamStats } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface MatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { id } = await params;
  const match = getMatchById(id);

  if (!match) {
    notFound();
  }

  const pred = getPredictionsForMatch(id);
  const homeStats = getTeamStats(match.homeTeamId);
  const awayStats = getTeamStats(match.awayTeamId);

  // Form points calculator helper
  const calculateFormRatio = (form: ('W' | 'D' | 'L')[] = []) => {
    if (form.length === 0) return 0;
    const wins = form.filter((f) => f === 'W').length;
    return Math.round((wins / form.length) * 100);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
        <Link href="/dashboard" className="hover:text-emerald-400 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/scanner" className="hover:text-emerald-400 transition-colors">Scanner</Link>
        <span>/</span>
        <span className="text-slate-300">Match #{id.slice(0, 8)}</span>
      </div>

      {/* Main Fixture Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1 flex items-center justify-between w-full md:w-auto gap-8">
          {/* Home Team */}
          <div className="text-center md:text-left flex-1">
            <Badge className="bg-slate-950 text-slate-400 hover:bg-slate-950 mb-2 font-mono text-[10px]">Home Team</Badge>
            <h2 className="text-xl md:text-2xl font-extrabold text-white">{match.homeTeam?.name}</h2>
            <div className="flex items-center justify-center md:justify-start gap-1 mt-2">
              {homeStats?.last10Form.slice(-5).map((outcome, idx) => (
                <span
                  key={idx}
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-mono ${
                    outcome === 'W'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : outcome === 'D'
                      ? 'bg-slate-850 text-slate-400 border border-slate-700'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {outcome}
                </span>
              ))}
            </div>
          </div>

          {/* VS Divider */}
          <div className="text-center font-mono text-slate-600 font-bold px-4 text-sm uppercase">
            VS
          </div>

          {/* Away Team */}
          <div className="text-center md:text-right flex-1">
            <Badge className="bg-slate-950 text-slate-400 hover:bg-slate-950 mb-2 font-mono text-[10px]">Away Team</Badge>
            <h2 className="text-xl md:text-2xl font-extrabold text-white">{match.awayTeam?.name}</h2>
            <div className="flex items-center justify-center md:justify-end gap-1 mt-2">
              {awayStats?.last10Form.slice(-5).map((outcome, idx) => (
                <span
                  key={idx}
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-mono ${
                    outcome === 'W'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : outcome === 'D'
                      ? 'bg-slate-850 text-slate-400 border border-slate-700'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {outcome}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Kickoff Info Box */}
        <div className="w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-8 text-center md:text-left flex flex-col shrink-0">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Kickoff Time</span>
          <span className="text-sm font-semibold text-slate-300 mt-1" suppressHydrationWarning>
            {new Date(match.kickoffTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-xl font-bold text-white mt-0.5" suppressHydrationWarning>
            {new Date(match.kickoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-[11px] text-slate-400 mt-2 font-mono">{match.league}</span>
        </div>
      </div>

      {/* Analytics Tabs and Poisson Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Market Analyses Tab Component (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="handicap" className="w-full">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full grid grid-cols-3 h-12 rounded-lg">
              <TabsTrigger value="handicap" className="rounded-md font-medium text-xs py-2 data-[state=active]:bg-slate-805 data-[state=active]:text-white">
                Asian Handicap
              </TabsTrigger>
              <TabsTrigger value="totals" className="rounded-md font-medium text-xs py-2 data-[state=active]:bg-slate-805 data-[state=active]:text-white">
                Over/Under Goals
              </TabsTrigger>
              <TabsTrigger value="moneyline" className="rounded-md font-medium text-xs py-2 data-[state=active]:bg-slate-805 data-[state=active]:text-white">
                Moneyline (1X2)
              </TabsTrigger>
            </TabsList>

            {/* Asian Handicap Content */}
            <TabsContent value="handicap" className="mt-4 outline-none">
              {pred ? (
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base text-white">Asian Handicap Valuation</CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                          Probability calculations for target handicap line.
                        </CardDescription>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Line: {pred.handicapLine > 0 ? `+${pred.handicapLine}` : pred.handicapLine}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Performance comparison rows */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-center font-mono">
                        <span className="text-[10px] text-slate-500 uppercase block">Model Prob.</span>
                        <span className="text-2xl font-bold text-white block mt-1">
                          {Math.round(pred.handicapProbability * 100)}%
                        </span>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-center font-mono">
                        <span className="text-[10px] text-slate-500 uppercase block">Fair Odds</span>
                        <span className="text-2xl font-bold text-white block mt-1">{pred.handicapFairOdds.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-center font-mono">
                        <span className="text-[10px] text-slate-500 uppercase block">Market Odds</span>
                        <span className="text-2xl font-bold text-white block mt-1">{pred.handicapMarketOdds.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-center font-mono">
                        <span className="text-[10px] text-slate-500 uppercase block">Calculated Edge</span>
                        <span className={`text-2xl font-bold block mt-1 ${pred.handicapEdgePercent > 5 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {pred.handicapEdgePercent > 0 ? `+${pred.handicapEdgePercent}%` : `${pred.handicapEdgePercent}%`}
                        </span>
                      </div>
                    </div>

                    {/* Verdict / Decision-support Banner */}
                    {pred.handicapEdgePercent > 3 ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-0.5">!</div>
                        <div>
                          <span className="text-xs font-semibold text-emerald-400 block">Calculated Edge Identified</span>
                          <p className="text-xs text-slate-300 mt-1">
                            Our model places the probability of <strong>{match.homeTeam?.name} covering {pred.handicapLine}</strong> at {Math.round(pred.handicapProbability * 100)}%, making the fair odds {pred.handicapFairOdds.toFixed(2)}. The average market price is {pred.handicapMarketOdds.toFixed(2)}, yielding an edge of <span className="text-emerald-400 font-bold">+{pred.handicapEdgePercent}%</span>.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 text-xs text-slate-400">
                        No mathematically viable value edge identified on this handicap line. The bookmaker odds correspond closely with our model projections.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="py-8 text-center text-slate-500">No prediction statistics loaded.</div>
              )}
            </TabsContent>

            {/* Over/Under Goals Content */}
            <TabsContent value="totals" className="mt-4 outline-none">
              {pred ? (
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base text-white">Goals Over/Under Analytics</CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                          Total match goals projections relative to market benchmarks.
                        </CardDescription>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Total Line: {pred.totalLine} Goals
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Probability split bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Over {pred.totalLine} Goals ({Math.round(pred.overProbability * 100)}%)</span>
                        <span className="text-slate-400">Under {pred.totalLine} Goals ({Math.round(pred.underProbability * 100)}%)</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-850 flex overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pred.overProbability * 100}%` }}></div>
                        <div className="h-full bg-slate-800" style={{ width: `${pred.underProbability * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 text-center font-mono">
                        <span className="text-[10px] text-slate-500 uppercase block font-medium">Over Probability</span>
                        <span className="text-xl font-bold text-white block mt-1">{Math.round(pred.overProbability * 100)}%</span>
                        <span className="text-[10px] text-slate-400 mt-1 block">Fair Odds: {(1 / pred.overProbability).toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 text-center font-mono">
                        <span className="text-[10px] text-slate-500 uppercase block font-medium">Under Probability</span>
                        <span className="text-xl font-bold text-white block mt-1">{Math.round(pred.underProbability * 100)}%</span>
                        <span className="text-[10px] text-slate-400 mt-1 block">Fair Odds: {(1 / pred.underProbability).toFixed(2)}</span>
                      </div>
                    </div>

                    {pred.ouEdgePercent > 3 ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-xs text-slate-300">
                        Model identifies value on the <strong className="text-emerald-400">Over {pred.totalLine}</strong> option with a calculated edge of <strong>+{pred.ouEdgePercent}%</strong>. Combine with defensive stats details.
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 text-xs text-slate-400">
                        No goals line market edge identified. Predictions align within standard goal expectation models.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="py-8 text-center text-slate-500">No prediction statistics loaded.</div>
              )}
            </TabsContent>

            {/* Moneyline Content */}
            <TabsContent value="moneyline" className="mt-4 outline-none">
              {pred ? (
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-base text-white">Moneyline (1X2) Projections</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      Standard match outcome probabilities.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Columns representation */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Home */}
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg text-center flex flex-col justify-between font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Home Win</span>
                          <span className="text-xs text-slate-300 font-semibold mt-1 block">{match.homeTeam?.name}</span>
                        </div>
                        <span className="text-2xl font-bold text-white mt-4 block">
                          {Math.round(pred.homeProbability * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-500 mt-2 block">Fair Odds: {(1 / pred.homeProbability).toFixed(2)}</span>
                      </div>

                      {/* Draw */}
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg text-center flex flex-col justify-between font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Draw</span>
                          <span className="text-xs text-slate-400 mt-1 block">Tied Score</span>
                        </div>
                        <span className="text-2xl font-bold text-white mt-4 block">
                          {Math.round(pred.drawProbability * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-500 mt-2 block">Fair Odds: {(1 / pred.drawProbability).toFixed(2)}</span>
                      </div>

                      {/* Away */}
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg text-center flex flex-col justify-between font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Away Win</span>
                          <span className="text-xs text-slate-300 font-semibold mt-1 block">{match.awayTeam?.name}</span>
                        </div>
                        <span className="text-2xl font-bold text-white mt-4 block">
                          {Math.round(pred.awayProbability * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-500 mt-2 block">Fair Odds: {(1 / pred.awayProbability).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="py-8 text-center text-slate-500">No prediction statistics loaded.</div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Info Column (1/3 width): Confidence & Poisson Feedstock */}
        <div className="space-y-6">
          {/* Confidence Indicator Card */}
          {pred && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-400 uppercase font-mono tracking-wider">Model Confidence</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-4">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {/* Confidence Circle Indicator */}
                  <svg className="w-full.h-full transform -rotate-95">
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-slate-800"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-emerald-400"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 60}
                      strokeDashoffset={(2 * Math.PI * 60) * (1 - pred.confidenceScore / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-white">{pred.confidenceScore}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Confidence</span>
                  </div>
                </div>
                <div className="text-center text-xs text-slate-400 px-4 mt-6">
                  Confidence rating based on average historical goal differences, home/away performance stability, and form consistency.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Poisson Model Feedstock Card */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 uppercase font-mono tracking-wider">Poisson Engine Inputs</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Mathematical feedstock representing base team strengths.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Home goals */}
              <div className="space-y-1 bg-slate-950 p-2.5 rounded border border-slate-850">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-semibold">{match.homeTeam?.name} (Home)</span>
                  <span className="text-emerald-400 font-bold">{homeStats?.homeGoalsFor.toFixed(2)} exp</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 flex justify-between">
                  <span>Avg Conceded: {homeStats?.homeGoalsAgainst.toFixed(2)}</span>
                  <span>Form Win Ratio: {calculateFormRatio(homeStats?.last10Form)}%</span>
                </div>
              </div>

              {/* Away goals */}
              <div className="space-y-1 bg-slate-950 p-2.5 rounded border border-slate-850">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-semibold">{match.awayTeam?.name} (Away)</span>
                  <span className="text-emerald-400 font-bold">{awayStats?.awayGoalsFor.toFixed(2)} exp</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 flex justify-between">
                  <span>Avg Conceded: {awayStats?.awayGoalsAgainst.toFixed(2)}</span>
                  <span>Form Win Ratio: {calculateFormRatio(awayStats?.last10Form)}%</span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-slate-500 p-1 border-t border-slate-800 mt-2">
                Poisson models calculate precise score probabilities by multiplying overall league constants against these localized expectancy figures.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
