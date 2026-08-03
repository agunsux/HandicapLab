import { MarketPage } from '@/components/terminal/MarketPage';

export const metadata = {
  title: 'Asian Handicap',
  description:
    'Asian Handicap value opportunities — model probability vs Pinnacle odds across handicap lines.',
};

export default function AsianHandicapPage() {
  return (
    <MarketPage
      market="asian_handicap"
      description="Value opportunities across Asian Handicap lines, benchmarked against Pinnacle."
    />
  );
}