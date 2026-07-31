import { headers } from 'next/headers';
import Link from 'next/link';
import { CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PricingCards } from './PricingCards';
import { resolvePppPrice } from '@/lib/pricing/ppp';
import { StructuredData } from '@/components/StructuredData';

export const metadata = {
  title: 'Pricing',
  description:
    'Transparent pricing for football market intelligence. Free, Starter, Pro, and Quant plans with a 14-day free trial and 30-day money-back guarantee.',
};

const FAQS = [
  {
    q: 'What is included in the free trial?',
    a: 'The 14-day free trial gives you full access to the Pro plan, including unlimited edges, the full premium detail panel, and advanced diagnostics. No credit card is required.',
  },
  {
    q: 'How does the money-back guarantee work?',
    a: 'If you are not satisfied within 30 days of your purchase, contact us and we will refund you in full. No questions asked.',
  },
  {
    q: 'What is PPP pricing?',
    a: 'We automatically adjust pricing based on your country to make HandicapLab accessible globally. Prices are adjusted transparently using purchasing power parity factors.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription at any time from your account settings. You will retain access until the end of your billing period.',
  },
];

export default async function PricingPage() {
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || 'US';

  const plans = [
    {
      tier: 'free',
      name: 'Free',
      priceUSD: 0,
      tagline: 'Basic market overview.',
      features: ['View up to 3 edges per day', 'Basic match statistics', 'Public track record access'],
      cta: 'Create Free Account',
      highlighted: false,
    },
    {
      tier: 'starter',
      name: 'Starter',
      priceUSD: 9,
      tagline: 'For casual bettors.',
      features: ['10 edges per day', 'Limited scanner', 'Basic statistics', 'Email alerts'],
      cta: 'Start Free Trial',
      highlighted: false,
    },
    {
      tier: 'pro',
      name: 'Pro',
      priceUSD: 29,
      tagline: 'Full professional intelligence.',
      features: [
        'Unlimited edges & alerts',
        'Full Premium Detail Panel',
        'Advanced diagnostics & Brier Score',
        'CLV tracking',
        'Priority Support',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      tier: 'quant',
      name: 'Quant',
      priceUSD: 99,
      tagline: 'For syndicates & developers.',
      features: [
        'Everything in Pro',
        'API access',
        'Raw odds exports',
        'Real-time webhooks',
        'Dedicated support',
      ],
      cta: 'Start Free Trial',
      highlighted: false,
    },
  ];

  const pppPlans = plans.map((plan) => ({
    ...plan,
    ppp: resolvePppPrice(plan.priceUSD, country),
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <StructuredData
        type="FAQPage"
        data={FAQS}
      />

      {/* Header */}
      <section className="pt-16 pb-12 px-4 text-center">
        <div className="container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="size-4" />
            14-Day Free Trial · No Credit Card Required
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Transparent pricing for
            <br className="hidden md:block" />
            <span className="text-primary"> serious intelligence.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Every paid plan includes a 14-day free trial and our 30-day
            money-back guarantee. Prices adjust automatically by country.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <PricingCards plans={pppPlans} />

      {/* Guarantee */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="size-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4">30-Day Money-Back Guarantee</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            We are confident in the quality of our intelligence. If you are not
            satisfied within 30 days of your purchase, contact us and we will
            refund you in full. No questions asked.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-muted/20 border-y border-border px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Pricing FAQ</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group bg-card border border-border rounded-xl p-6">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground list-none">
                  {faq.q}
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90 shrink-0 ml-4" />
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to make data-driven decisions?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Start your 14-day free trial today. No credit card required.
          </p>
          <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-full" asChild>
            <Link href="/signup">Start Free 14-Day Trial</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
