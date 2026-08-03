import Link from 'next/link';
import { Bell, CreditCard, Shield, User } from 'lucide-react';

export const metadata = {
  title: 'Profile',
  description: 'HandicapLab account profile and subscription.',
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-display font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and subscription.</p>
      </div>

      {/* Account */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Account
        </h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
              HL
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Pro Analyst</div>
              <div className="text-xs text-muted-foreground">analyst@handicaplab.com</div>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div className="border-t border-border/60 pt-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5" /> Username
              </dt>
              <dd className="mt-1 font-medium text-foreground">pro-analyst</dd>
            </div>
            <div className="border-t border-border/60 pt-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="h-3.5 w-3.5" /> Tier
              </dt>
              <dd className="mt-1 font-medium text-foreground">Pro — $29/mo</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Subscription */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Subscription
        </h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Pro Plan</span>
            </div>
            <Link
              href="/pricing"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Manage
            </Link>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Full access to all four markets, EV feed and historical edge indicators.
          </p>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Notifications
        </h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">New value opportunities</span>
            </div>
            <span className="rounded bg-signal-positive-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-positive">
              On
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}