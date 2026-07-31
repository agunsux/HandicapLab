'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PppPriceResult } from '@/lib/pricing/ppp';

export interface PricingPlan {
  tier: string;
  name: string;
  priceUSD: number;
  tagline: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  ppp: PppPriceResult;
}

interface PricingCardsProps {
  plans: PricingPlan[];
}

export function PricingCards({ plans }: PricingCardsProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const yearlyDiscount = 0.2; // 20% off for yearly

  return (
    <section className="px-4 pb-8">
      <div className="container mx-auto max-w-6xl">
        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-medium transition-colors',
                billing === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={billing === 'monthly'}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-medium transition-colors',
                billing === 'yearly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={billing === 'yearly'}
            >
              Yearly
              <span className="ml-2 text-xs font-semibold text-primary">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const base = plan.ppp.adjustedPrice;
            const price = billing === 'yearly' ? Math.round(base * (1 - yearlyDiscount)) : base;
            const isFree = plan.priceUSD === 0;

            return (
              <div
                key={plan.tier}
                className={cn(
                  'flex flex-col rounded-2xl border p-8',
                  plan.highlighted
                    ? 'border-primary/40 bg-card elevation-2 relative'
                    : 'border-border bg-card elevation-1'
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 inset-x-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-6">{plan.tagline}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold font-mono">
                    {isFree ? '$0' : `$${price}`}
                  </span>
                  <span className="text-base text-muted-foreground font-sans">
                    {isFree ? '/forever' : billing === 'monthly' ? '/mo' : '/mo billed yearly'}
                  </span>
                </div>

                {plan.ppp.adjusted && (
                  <p className="text-xs text-muted-foreground mb-4">
                    PPP-adjusted for your region
                  </p>
                )}

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle2
                        className={cn(
                          'size-5 shrink-0 mt-0.5',
                          plan.highlighted ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.highlighted ? 'default' : 'outline'}
                  className={cn('w-full rounded-full font-semibold', !plan.highlighted && 'border-border')}
                >
                  <Link href="/signup">{plan.cta}</Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          All paid plans include a 14-day free trial and our 30-day money-back guarantee.
        </p>
      </div>
    </section>
  );
}
