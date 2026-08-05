import { getSecureOpportunities } from '@/services/opportunities.service';
import { OpportunitiesTable } from '@/components/opportunities/OpportunitiesTable';
import { headers } from 'next/headers';

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
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || undefined;

  const mappedOpportunities = await getSecureOpportunities(userId, 50);

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
          {mappedOpportunities.length} opportunities
        </span>
      </div>

      <OpportunitiesTable data={mappedOpportunities} />
    </div>
  );
}