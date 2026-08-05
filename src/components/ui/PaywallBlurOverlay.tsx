'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaywallBlurOverlayProps {
  title?: string;
  description?: string;
  ctaText?: string;
  className?: string;
}

export function PaywallBlurOverlay({
  title = 'Pro Edge Data Locked',
  description = 'Model probabilities, fair odds, and calibrated EV metrics are reserved for Pro subscribers.',
  ctaText = 'Upgrade to Pro — $29/mo',
  className,
}: PaywallBlurOverlayProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[#1F232C] bg-[#111318]/90 p-6 backdrop-blur-md text-center flex flex-col items-center justify-center space-y-3',
        className
      )}
    >
      <div className="h-10 w-10 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/30 flex items-center justify-center text-[#818CF8]">
        <Lock className="h-5 w-5" />
      </div>

      <div className="max-w-md">
        <h4 className="text-sm font-semibold tracking-tight text-[#F0F1F5] flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          {title}
        </h4>
        <p className="mt-1 text-xs text-[#8B92A8] leading-relaxed">{description}</p>
      </div>

      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#818CF8] transition-colors shadow-sm"
      >
        {ctaText}
      </Link>
    </div>
  );
}
