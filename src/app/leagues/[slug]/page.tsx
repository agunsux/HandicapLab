import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeagueDetailRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/competitions/${slug}`);
}
