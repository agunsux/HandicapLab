import { MarketPage } from '@/components/terminal/MarketPage';

export const metadata = {
  title: 'Moneyline',
  description:
    'Moneyline 1X2 value opportunities — model win probabilities versus bookmaker market odds.',
};

export default function MoneylinePage() {
  return (
    <MarketPage
      market="moneyline"
      description="1X2 Moneyline value opportunities, benchmarked against market odds."
    />
  );
}