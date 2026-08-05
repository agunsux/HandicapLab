import { MarketPage } from '@/components/terminal/MarketPage';

export const metadata = {
  title: 'Over / Under',
  description:
    'Over / Under value opportunities — goal-total probability versus market pricing.',
};

export default function OverUnderPage() {
  return (
    <MarketPage
      market="over-under"
      description="Value opportunities on goal totals, with model probability vs market odds."
    />
  );
}