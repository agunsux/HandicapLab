import React from 'react';
import MatchDetailClient from './MatchDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function MatchDetailPage() {
  return <MatchDetailClient />;
}
