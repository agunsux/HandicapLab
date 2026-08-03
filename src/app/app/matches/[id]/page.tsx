import { MatchDetailView } from '@/components/terminal/MatchDetailView';
import { DEMO_VALUE_BETS } from '@/app/app/_data/terminal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const bet = DEMO_VALUE_BETS.find((b) => b.id === id);
  if (!bet) return { title: 'Match' };
  return {
    title: `${bet.homeTeam} vs ${bet.awayTeam} — Market Analysis`,
    description: `Four-market analysis for ${bet.homeTeam} vs ${bet.awayTeam}: Asian Handicap, Over / Under, Moneyline and BTTS.`,
  };
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <MatchDetailView matchId={id} />;
}