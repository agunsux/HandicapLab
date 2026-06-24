import React from 'react';

interface BreadcrumbItem {
  name: string;
  item: string;
}

interface StructuredDataProps {
  type: 'Organization' | 'BreadcrumbList' | 'FAQPage' | 'SportsEvent';
  data: any;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  let schema: any = null;

  if (type === 'Organization') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'HandicapLab',
      url: 'https://handicap-lab.vercel.app',
      logo: 'https://handicap-lab.vercel.app/favicon.ico',
      description: 'Quantitative football market intelligence powered by ensembled goal expectation models.'
    };
  } else if (type === 'BreadcrumbList') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: data.map((item: BreadcrumbItem, index: number) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.item
      }))
    };
  } else if (type === 'FAQPage') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.map((faq: { q: string; a: string }) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a
        }
      }))
    };
  } else if (type === 'SportsEvent') {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: data.name,
      startDate: data.startDate,
      homeTeam: {
        '@type': 'SportsTeam',
        name: data.homeTeam
      },
      awayTeam: {
        '@type': 'SportsTeam',
        name: data.awayTeam
      },
      sport: 'Soccer',
      competitor: [
        { '@type': 'SportsTeam', name: data.homeTeam },
        { '@type': 'SportsTeam', name: data.awayTeam }
      ]
    };
  }

  if (!schema) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
