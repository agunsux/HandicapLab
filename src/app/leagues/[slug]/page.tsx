import { redirect } from 'next/navigation';
import { STATIC_LEAGUES } from '@/lib/data/leagues';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return STATIC_LEAGUES.map((l) => ({ slug: l.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeagueDetailRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/competitions/${slug}`);
}
