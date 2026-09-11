import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/scanner/'],
    },
    sitemap: 'https://handicaplab.dev/sitemap.xml',
  };
}
