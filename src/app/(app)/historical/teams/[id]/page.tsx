import React from 'react';
import TeamDetailClient from './TeamDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function TeamDetailPage() {
  return <TeamDetailClient />;
}
