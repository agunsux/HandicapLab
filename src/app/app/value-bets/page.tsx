import { DEMO_VALUE_BETS } from '@/app/app/_data/terminal';
import { ValueBetsFeed } from '@/components/terminal/ValueBetsFeed';

export const metadata = {
  title: 'Value Bets',
  description:
    'High-EV football opportunities ranked by expected value, with model probability, market odds, fair odds, and historical edge.',
};

export default async function ValueBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="flex flex-col h-full space-y-5 pb-8">
      {/* Page header — calm, precise */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold tracking-tight text-foreground">
            Value Bets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            High-EV opportunities across Asian Handicap, Over / Under, Moneyline and BTTS.
          </p>
        </div>
        <span className="hidden sm:block text-xs text-muted-foreground tabular-nums">
          {DEMO_VALUE_BETS.length} opportunities
        </span>
      </div>

      <ValueBetsFeed bets={DEMO_VALUE_BETS} searchQuery={q || ''} />
    </div>
  );
}