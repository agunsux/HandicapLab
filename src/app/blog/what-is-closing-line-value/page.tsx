import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StructuredData } from '@/components/StructuredData';

export const metadata = {
  title: 'What Is Closing Line Value (CLV) and Why It Matters',
  description:
    'CLV is the single most important metric for serious bettors. Learn how to measure it, why it beats win rate, and how HandicapLab tracks it against Pinnacle.',
  alternates: {
    canonical: 'https://handicaplab.com/blog/what-is-closing-line-value',
  },
  openGraph: {
    title: 'What Is Closing Line Value (CLV) and Why It Matters',
    description:
      'CLV is the single most important metric for serious bettors. Learn how to measure it, why it beats win rate, and how HandicapLab tracks it against Pinnacle.',
    type: 'article',
    publishedTime: '2026-07-28',
  },
};

const FAQS = [
  {
    q: 'What is closing line value (CLV)?',
    a: 'CLV measures the difference between the odds you took and the closing line odds set by sharp bookmakers like Pinnacle. Positive CLV means you consistently beat the market.',
  },
  {
    q: 'Why is CLV more important than win rate?',
    a: 'Win rate can be misleading due to variance. CLV reflects whether you have a real edge over the market, which is the only sustainable predictor of long-term profitability.',
  },
  {
    q: 'How does HandicapLab track CLV?',
    a: 'HandicapLab benchmarks every recommendation against Pinnacle closing lines, the sharpest odds in the market, and publishes the results transparently.',
  },
];

export default function ClvArticlePage() {
  return (
    <article className="flex flex-col min-h-screen">
      {/* Article schema */}
      <StructuredData
        type="BreadcrumbList"
        data={[
          { name: 'Home', item: 'https://handicaplab.com' },
          { name: 'Blog', item: 'https://handicaplab.com/blog' },
          { name: 'What Is Closing Line Value (CLV)', item: 'https://handicaplab.com/blog/what-is-closing-line-value' },
        ]}
      />
      <StructuredData type="FAQPage" data={FAQS} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'What Is Closing Line Value (CLV) and Why It Matters',
            description:
              'CLV is the single most important metric for serious bettors. Learn how to measure it, why it beats win rate, and how HandicapLab tracks it against Pinnacle.',
            datePublished: '2026-07-28',
            dateModified: '2026-07-28',
            author: { '@type': 'Organization', name: 'HandicapLab' },
            publisher: { '@type': 'Organization', name: 'HandicapLab' },
            mainEntityOfPage: 'https://handicaplab.com/blog/what-is-closing-line-value',
          }),
        }}
      />

      {/* Back link */}
      <div className="container mx-auto max-w-3xl px-4 pt-10">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Blog
        </Link>
      </div>

      {/* Article header */}
      <header className="container mx-auto max-w-3xl px-4 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            CLV
          </span>
          <span className="text-sm text-muted-foreground">July 28, 2026</span>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">8 min read</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          What Is Closing Line Value (CLV) and Why It Matters
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          CLV is the single most important metric for serious bettors. Learn how
          to measure it, why it beats win rate, and how HandicapLab tracks it
          against Pinnacle.
        </p>
      </header>

      {/* Article body */}
      <div className="container mx-auto max-w-3xl px-4 pb-16">
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <p>
            Most bettors obsess over win rate. But win rate is a noisy,
            short-term number that tells you almost nothing about whether you
            actually have an edge. The metric that matters is{" "}
            <strong className="text-foreground">Closing Line Value (CLV)</strong>.
          </p>

          <h2 className="text-2xl font-bold text-foreground tracking-tight pt-4">
            What Is CLV?
          </h2>
          <p>
            CLV measures the difference between the odds you took and the odds
            at which the market closed. If you bet a team at 2.00 and the
            closing line was 1.90, you gained positive CLV — you beat the market
            by 10 cents. If you bet at 2.00 and the line closed at 2.10, you
            lost value.
          </p>

          <h2 className="text-2xl font-bold text-foreground tracking-tight pt-4">
            Why CLV Beats Win Rate
          </h2>
          <p>
            Win rate is subject to massive variance over small samples. A bettor
            can win 60% of bets over a month and still be losing money if they
            consistently take bad prices. Conversely, a bettor with a 48% win
            rate can be highly profitable if their average winning odds are
            high enough.
          </p>
          <p>
            CLV cuts through this noise. Because closing lines are set by the
            sharpest operators in the market (led by Pinnacle), consistently
            beating the closing line is strong evidence of a real, sustainable
            edge.
          </p>

          <h2 className="text-2xl font-bold text-foreground tracking-tight pt-4">
            How HandicapLab Tracks CLV
          </h2>
          <p>
            HandicapLab benchmarks every recommendation against Pinnacle closing
            lines — the sharpest odds available. Our track record is an open
            ledger, and we publish CLV alongside ROI, Brier scores, and
            calibration curves so you can verify the quality of the edge
            yourself.
          </p>

          <div className="bg-card border border-border rounded-xl p-6 mt-8">
            <h3 className="font-semibold text-foreground mb-3">Key Takeaways</h3>
            <ul className="space-y-2 text-sm">
              <li>• CLV measures whether you beat the market, not just whether you won.</li>
              <li>• Positive CLV is the strongest predictor of long-term profitability.</li>
              <li>• Win rate is noisy; CLV is signal.</li>
              <li>• Pinnacle closing lines are the industry benchmark for sharp odds.</li>
            </ul>
          </div>
        </div>

        {/* Next article */}
        <div className="mt-12 pt-8 border-t border-border">
          <Link
            href="/blog/asian-handicap-explained"
            className="group flex items-center justify-between bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors"
          >
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Next article</div>
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Asian Handicap Explained: A Complete Guide
              </div>
            </div>
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
