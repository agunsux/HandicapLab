import { MarketPage } from '@/components/terminal/MarketPage';

export const metadata = {
  title: 'Both Teams To Score (BTTS)',
  description:
    'Both Teams To Score value opportunities — BTTS probability versus market pricing.',
};

export default function BttsPage() {
  return (
    <MarketPage
      market="btts"
      description="Value opportunities on Both Teams To Score, with model probability vs market odds."
    />
  );
}