'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, X, Shield, Sparkles, CreditCard } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

export function PricingCards() {
  const { userTier, setUserTier } = useAppStore();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      tier: 'free' as const,
      name: 'FREE',
      price: 0,
      period: 'forever',
      description: 'Basic match overview & static data.',
      included: ['5 signals / day', 'Basic match data', '1 market filter', 'Delayed odds (5 min)'],
      excluded: ['EV calculations', 'Sharp money tracker', 'Line movement alerts', 'API access'],
      cta: userTier === 'free' ? 'Current Plan' : 'Select Free Plan',
      buttonStyle: 'bg-[#111827] border border-[#1F2937] text-[#9CA3AF] hover:text-[#F0FDF4]',
      highlighted: false,
    },
    {
      tier: 'pro' as const,
      name: 'PRO',
      price: billing === 'monthly' ? 49 : 39,
      period: '/ month',
      description: 'Full real-time quantitative engine.',
      included: [
        'Unlimited signals',
        'Real-time odds',
        'All 4 markets (AH, OU, ML, BTTS)',
        'EV + Edge calculations',
        'Sharp money indicator',
        'Line movement alerts',
        'Email notifications',
      ],
      excluded: ['API access'],
      cta: userTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
      buttonStyle: 'bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold shadow-md',
      highlighted: true,
    },
    {
      tier: 'elite' as const,
      name: 'ELITE',
      price: billing === 'monthly' ? 149 : 119,
      period: '/ month',
      description: 'Institutional quant suite with API & webhooks.',
      included: [
        'Everything in Pro',
        'Custom ML models',
        'REST & Streaming API access',
        'Webhook alerts',
        'Priority support',
        'White-label options',
        'Team collaboration',
        'Custom integrations',
      ],
      excluded: [],
      cta: userTier === 'elite' ? 'Current Plan' : 'Contact Sales / Upgrade',
      buttonStyle: 'bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-bold shadow-md',
      highlighted: false,
    },
  ];

  const creditPacks = [
    { credits: 10, price: 9, badge: 'Starter Pack', desc: 'Test a few high-value signals' },
    { credits: 50, price: 39, badge: 'Best Value', desc: 'Popular for active weekend traders', popular: true },
    { credits: 200, price: 129, badge: 'Power User', desc: 'Bulk discount for serious quants' },
  ];

  return (
    <div className="space-y-12 py-6">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#111827] border border-[#1F2937]">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors ${
              billing === 'monthly'
                ? 'bg-[#10B981] text-black shadow-sm'
                : 'text-[#9CA3AF] hover:text-[#F0FDF4]'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors ${
              billing === 'yearly'
                ? 'bg-[#10B981] text-black shadow-sm'
                : 'text-[#9CA3AF] hover:text-[#F0FDF4]'
            }`}
          >
            Yearly Billing <span className="ml-1 text-[10px] font-bold text-[#F59E0B]">-20%</span>
          </button>
        </div>
      </div>

      {/* 3 Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.tier}
            className={`relative flex flex-col justify-between rounded-2xl p-8 transition-all ${
              plan.highlighted
                ? 'bg-[#111827] border-2 border-[#10B981] shadow-xl scale-[1.02]'
                : 'bg-[#111827]/60 border border-[#1F2937]'
            }`}
          >
            {/* Most Popular Ribbon */}
            {plan.highlighted && (
              <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                <span className="bg-[#10B981] text-black text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-sm flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Most Popular
                </span>
              </div>
            )}

            <div>
              <h3 className="text-xl font-bold text-[#F0FDF4] mb-1">{plan.name}</h3>
              <p className="text-xs text-[#9CA3AF] mb-6 min-h-[32px]">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-mono font-bold text-[#F0FDF4]">
                  ${plan.price}
                </span>
                <span className="text-xs text-[#9CA3AF] ml-1">{plan.period}</span>
              </div>

              <div className="border-t border-[#1F2937] pt-6 mb-6 space-y-3">
                {plan.included.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5 text-xs text-[#F0FDF4]">
                    <Check className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
                {plan.excluded.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5 text-xs text-[#9CA3AF]/50 line-through">
                    <X className="h-4 w-4 text-[#EF4444]/60 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setUserTier(plan.tier)}
              className={`w-full py-3 rounded-xl text-xs transition-colors ${plan.buttonStyle}`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[#9CA3AF]">
        No subscriptions required. Pay monthly, cancel anytime with one click.
      </p>

      {/* One-Time Credits Section */}
      <div className="mt-16 border-t border-[#1F2937] pt-12 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-xl font-bold text-[#F0FDF4] flex items-center justify-center gap-2">
            <CreditCard className="h-5 w-5 text-[#F59E0B]" /> One-Time Signal Credits
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Prefer not to subscribe? Unlock high-value signals individually with credit packs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {creditPacks.map((pack) => (
            <div
              key={pack.credits}
              className={`rounded-xl p-6 border transition-all ${
                pack.popular
                  ? 'bg-[#111827] border-[#F59E0B] shadow-lg'
                  : 'bg-[#111827]/40 border-[#1F2937]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-[#F0FDF4] font-mono">{pack.credits} Credits</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  pack.popular ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30' : 'bg-[#1F2937] text-[#9CA3AF]'
                }`}>
                  {pack.badge}
                </span>
              </div>

              <div className="text-2xl font-mono font-bold text-[#F0FDF4] mb-2">${pack.price}</div>
              <p className="text-xs text-[#9CA3AF] mb-6">{pack.desc}</p>

              <button className="w-full py-2.5 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#F59E0B]/50 text-xs font-semibold text-[#F0FDF4] transition-colors">
                Buy {pack.credits} Credits
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
