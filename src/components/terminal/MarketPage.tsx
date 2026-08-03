import { DEMO_VALUE_BETS, MarketType, MARKET_LABELS } from '@/app/app/_data/terminal';
import { ValueBetsFeed } from './ValueBetsFeed';

interface MarketPageProps {
  market: MarketType;
  description: string;
}

export function MarketPage({ market, description }: MarketPageProps) {
  const marketBets = DEMO_VALUE_BETS.filter((b) => b.market === market);

  return (
    <div className="flex flex-col space-y-5 pb-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold tracking-tight text-foreground">
            {MARKET_LABELS[market]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="hidden sm:block text-xs text-muted-foreground tabular-nums">
          {marketBets.length} opportunities
        </span>
      </div>

      <ValueBetsFeed bets={DEMO_VALUE_BETS} marketFilter={market} />
    </div>
  );
}