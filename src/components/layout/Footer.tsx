import Link from 'next/link';

const PRODUCT_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/live', label: "Today's Opportunities" },
  { href: '/markets', label: 'Markets' },
  { href: '/models', label: 'Models' },
  { href: '/performance', label: 'Performance' },
  { href: '/pricing', label: 'Pricing' },
];

const RESOURCE_LINKS = [
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Resources' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/track-record', label: 'Track Record' },
  { href: '/trust-center', label: 'Trust Center' },
  { href: '/validation', label: 'Validation' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/security', label: 'Security' },
  { href: '/responsible-gambling', label: 'Responsible Gambling' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                HL
              </div>
              <span className="font-semibold tracking-tight text-foreground">
                HandicapLab
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Football market intelligence. Quantitative modeling, closing line
              value, and transparent historical validation.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Resources</h3>
            <ul className="space-y-2.5">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust / Guarantee strip */}
        <div className="mt-12 border-t border-border pt-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <ShieldIcon className="size-3.5" />
                30-Day Money-Back Guarantee
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                14-Day Free Trial · No Credit Card Required
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} HandicapLab. All rights reserved.
            </p>
          </div>

          {/* Responsible gambling disclaimer */}
          <p className="mt-6 text-xs text-muted-foreground/80 leading-relaxed max-w-4xl">
            HandicapLab provides statistical analysis and market intelligence for
            informational and educational purposes only. It does not constitute
            financial or betting advice, and does not guarantee any outcome.
            Betting involves risk and can lead to financial loss. Please gamble
            responsibly and only wager what you can afford to lose. If you or
            someone you know has a gambling problem, seek help from a
            professional support service.
          </p>
        </div>
      </div>
    </footer>
  );
}

function ShieldIcon({ className }: { className?: string }) {
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
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
