import React from 'react';
import { AppShell } from '@/components/app-shell/AppShell';
import { Providers } from '@/components/providers/Providers';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}