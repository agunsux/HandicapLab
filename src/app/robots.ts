import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/scanner/'],
    },
    sitemap: 'https://handicap-lab.vercel.app/sitemap.xml',
  };
}
