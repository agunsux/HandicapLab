import React from 'react';
import CompetitionDetailClient from './CompetitionDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function CompetitionDetailPage() {
  return <CompetitionDetailClient />;
}
