import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { StructuredData } from '@/components/StructuredData';

export const metadata = {
  title: 'Blog',
  description:
    'Educational articles on Asian handicap, over/under, moneyline, expected goals (xG), value betting, closing line value (CLV), bankroll management, and football analytics.',
};

const CATEGORIES = [
  'Asian Handicap',
  'Over/Under',
  'Moneyline',
  'Expected Goals (xG)',
  'Value Betting',
  'CLV',
  'Bankroll Management',
  'Sports Analytics',
  'Machine Learning',
  'Football Statistics',
  'Guides',
  'Case Studies',
];

const POSTS = [
  {
    slug: 'what-is-closing-line-value',
    title: 'What Is Closing Line Value (CLV) and Why It Matters',
    excerpt:
      'CLV is the single most important metric for serious bettors. Learn how to measure it, why it beats win rate, and how HandicapLab tracks it against Pinnacle.',
    category: 'CLV',
    date: '2026-07-28',
    readTime: '8 min',
  },
  {
    slug: 'asian-handicap-explained',
    title: 'Asian Handicap Explained: A Complete Guide',
    excerpt:
      'Understand the quarter-ball, half-ball, and whole-ball handicap lines, and how to identify value in the world\u2019s sharpest football market.',
    category: 'Asian Handicap',
    date: '2026-07-25',
    readTime: '12 min',
  },
  {
    slug: 'expected-goals-xg-model',
    title: 'Expected Goals (xG): How Models Estimate True Probability',
    excerpt:
      'A deep dive into how xG models work, their limitations, and how they feed into probability estimation and edge detection.',
    category: 'Expected Goals (xG)',
    date: '2026-07-22',
    readTime: '10 min',
  },
  {
    slug: 'kelly-criterion-bankroll',
    title: 'The Kelly Criterion and Bankroll Management',
    excerpt:
      'How to size your stakes using fractional Kelly, manage drawdowns, and protect your bankroll through disciplined risk management.',
    category: 'Bankroll Management',
    date: '2026-07-18',
    readTime: '9 min',
  },
  {
    slug: 'value-betting-vs-tipster',
    title: 'Value Betting vs. Tipster Picks: Why Edge Beats Predictions',
    excerpt:
      'The difference between finding mathematical edge and following predictions. Why expected value is the only number that matters.',
    category: 'Value Betting',
    date: '2026-07-15',
    readTime: '7 min',
  },
  {
    slug: 'over-under-total-goals',
    title: 'Over/Under Markets: Reading Total Goals Lines',
    excerpt:
      'How bookmakers set total goals lines, how to spot mispriced overs and unders, and the role of team attacking and defensive profiles.',
    category: 'Over/Under',
    date: '2026-07-12',
    readTime: '8 min',
  },
];

export default function BlogPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <StructuredData
        type="BreadcrumbList"
        data={[{ name: 'Home', item: 'https://handicaplab.com' }, { name: 'Blog', item: 'https://handicaplab.com/blog' }]}
      />

      {/* Header */}
      <section className="pt-16 pb-12 px-4 text-center">
        <div className="container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <BookOpen className="size-4" />
            Education & Research
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Football Market Intelligence Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            In-depth guides on Asian handicap, value betting, CLV, xG, and the
            quantitative methods behind professional football analysis.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog/category/${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured post */}
      <section className="px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          <Link
            href="/blog/what-is-closing-line-value"
            className="group block bg-card border border-border rounded-2xl p-8 md:p-12 elevation-2 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                Featured
              </span>
              <span className="text-sm text-muted-foreground">CLV</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 group-hover:text-primary transition-colors">
              What Is Closing Line Value (CLV) and Why It Matters
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6">
              CLV is the single most important metric for serious bettors. Learn
              how to measure it, why it beats win rate, and how HandicapLab
              tracks it against Pinnacle.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>July 28, 2026</span>
              <span>·</span>
              <span>8 min read</span>
              <span className="inline-flex items-center gap-1 text-primary font-medium">
                Read article <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Post grid */}
      <section className="px-4 py-8 pb-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col bg-card border border-border rounded-2xl p-6 elevation-1 hover:border-primary/40 transition-colors"
              >
                <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase tracking-wider self-start mb-4">
                  {post.category}
                </span>
                <h3 className="text-lg font-semibold tracking-tight mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
