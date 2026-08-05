import { headers } from 'next/headers';
import { PricingCards } from './PricingCards';

export const metadata = {
  title: 'Pricing & Plans | HandicapLab',
  description:
    'Transparent pricing for football market intelligence. Free, Pro, and Elite plans with one-time credit options.',
};

const FAQS = [
  {
    q: 'What is included in the Free tier?',
    a: 'The Free plan gives you access to basic match schedules, 5 signals per day, and public track record verification.',
  },
  {
    q: 'Can I switch or cancel anytime?',
    a: 'Yes. You can upgrade, downgrade, or cancel your plan at any time without hidden fees.',
  },
  {
    q: 'How do One-Time Credits work?',
    a: 'Credits allow you to unlock individual high-confidence signals without committing to a monthly subscription. 1 Credit = 1 Signal unlock.',
  },
  {
    q: 'What is the Closing Line Value (CLV) guarantee?',
    a: 'Our quantitative models are continuously benchmarked against Pinnacle closing lines to guarantee positive expected value over sample sizes.',
  },
];

export default async function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0B0F0E] text-[#F0FDF4] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-xs font-semibold tracking-widest text-[#10B981] uppercase">
            Transparent Pricing · No Subscriptions Trap
          </h2>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-[#F0FDF4]">
            Invest in Edge. <span className="text-[#10B981]">Not Predictions.</span>
          </h1>
          <p className="text-base text-[#9CA3AF] leading-relaxed">
            Institutional sports trading analytics tailored for professional quants and disciplined traders.
          </p>
        </div>

        {/* Pricing Cards Component */}
        <PricingCards />

        {/* FAQs */}
        <div className="mt-20 border-t border-[#1F2937] pt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-[#F0FDF4] mb-10">
            Frequently Asked Questions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 space-y-2">
                <h4 className="font-bold text-sm text-[#F0FDF4]">{faq.q}</h4>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
