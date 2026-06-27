import { MetadataRoute } from 'next';
import { getTopLeagues } from '@/lib/data/leagues';
import { getAllTeams } from '@/lib/data/teams';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://handicap-lab.vercel.app';

  // Base pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    { url: `${baseUrl}/competitions`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/teams`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/performance`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
  ];

  // Dynamic League pages
  const leagues = await getTopLeagues();
  const leaguePages = leagues.map((l) => ({
    url: `${baseUrl}/competitions/${l.slug}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.9,
  }));

  // Dynamic Team pages
  const teams = await getAllTeams();
  const teamPages = teams.map((t) => ({
    url: `${baseUrl}/teams/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...leaguePages, ...teamPages];
}
