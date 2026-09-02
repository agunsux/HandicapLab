import React from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase.server';
import { getDashboardPerformance } from '@/lib/dashboardPerformance';
import { User, CreditCard, BarChart3, Bell, Shield, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Profile & Account — HandicapLab',
  description: 'Manage your HandicapLab account, plan entitlement, 14-day trial status, and personal betting performance.',
};

export default async function ProfilePage() {
  // 1. Fetch user & subscription from database layer
  let userEmail = 'analyst@handicaplab.com';
  let planTier = 'free';
  let subscriptionStatus: 'active' | 'trialing' | 'free' = 'trialing';
  let trialDay = 4;
  let trialDaysRemaining = 10;
  let expiryDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      userEmail = user.email || userEmail;

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (sub) {
        planTier = sub.tier || 'free';
        subscriptionStatus = sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'trialing' : 'free';

        if (sub.current_period_end) {
          const endMs = new Date(sub.current_period_end).getTime();
          const startMs = sub.current_period_start
            ? new Date(sub.current_period_start).getTime()
            : endMs - 14 * 24 * 60 * 60 * 1000;
          const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
          const passedDays = Math.max(1, Math.round((Date.now() - startMs) / (1000 * 60 * 60 * 24)));
          trialDay = Math.min(totalDays, passedDays);
          trialDaysRemaining = Math.max(0, totalDays - passedDays);
          expiryDate = new Date(sub.current_period_end).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[ProfilePage] Failed to fetch live auth profile:', err);
  }

  // 2. Fetch real personal performance
  const perf = await getDashboardPerformance();

  const trialProgressPct = Math.min(100, Math.round((trialDay / 14) * 100));

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl pt-24 pb-16 flex-1 space-y-8">
      {/* Page Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
          <User className="h-3.5 w-3.5" />
          ACCOUNT &bull; PROFILE OVERVIEW
        </div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">
          Manage your account credentials, trial entitlement, and track record.
        </p>
      </div>

      {/* SECTION 1 — WHO AM I (PROFILE) */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">Profile</h2>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Email Address</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{userEmail}</span>
            </div>
            <div className="text-right">
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Account Status</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 uppercase mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Verified
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — SUBSCRIPTION & 14-DAY TRIAL */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">
          Subscription & Entitlement
        </h2>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-6 space-y-5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white uppercase font-sans">
                  {planTier === 'pro'
                    ? 'Pro Plan ($29/mo)'
                    : planTier === 'quant'
                    ? 'Quant Plan ($99/mo)'
                    : '14-Day Free Trial (Full Access)'}
                </span>
                <span className="text-[11px] text-[#9CA3AF] block mt-0.5">
                  Asian Handicap, Over/Under &amp; BTTS quantitative signals.
                </span>
              </div>
            </div>

            <Link
              href="/pricing"
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold text-xs transition-colors"
            >
              Manage
            </Link>
          </div>

          {/* Trial Progress Bar */}
          {subscriptionStatus === 'trialing' && (
            <div className="pt-4 border-t border-[#1F2937] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white font-bold">14-Day Free Trial</span>
                <span className="text-[#10B981] font-bold">
                  Day {trialDay} of 14 ({trialDaysRemaining} days remaining)
                </span>
              </div>

              <div className="w-full bg-[#0B0F0E] h-2 rounded-full overflow-hidden border border-[#1F2937]">
                <div
                  className="bg-[#10B981] h-full rounded-full transition-all"
                  style={{ width: `${trialProgressPct}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-[#9CA3AF] pt-1">
                <span>Started</span>
                <span>Trial ends on {expiryDate}</span>
              </div>
            </div>
          )}

          {subscriptionStatus === 'active' && (
            <div className="pt-3 border-t border-[#1F2937] flex justify-between text-xs text-[#9CA3AF]">
              <span>Current billing period ends:</span>
              <span className="text-white font-bold">{expiryDate}</span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3 — YOUR PERFORMANCE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">
            Your Performance
          </h2>
          <Link
            href="/track-record"
            className="text-xs font-mono text-[#10B981] hover:underline flex items-center gap-1"
          >
            View Full Track Record <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-5 font-mono text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]/60">
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Bets</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{perf.totalBets}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]/60">
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Won</span>
              <span className="text-lg font-bold text-[#10B981] mt-0.5 block">{perf.won}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]/60">
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Lost</span>
              <span className="text-lg font-bold text-red-400 mt-0.5 block">{perf.lost}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]/60">
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Win Rate</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {perf.hasData ? `${perf.winRate.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]/60 col-span-2 sm:col-span-1">
              <span className="text-[#9CA3AF] text-[10px] uppercase block">Yield / ROI</span>
              <span
                className={cn(
                  'text-lg font-bold mt-0.5 block',
                  perf.yieldRoi >= 0 ? 'text-[#10B981]' : 'text-red-400'
                )}
              >
                {perf.hasData ? `${perf.yieldRoi >= 0 ? '+' : ''}${perf.yieldRoi.toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — SETTINGS */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF]">Settings</h2>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-5 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-[#9CA3AF]" />
              <div>
                <span className="text-white font-bold block">Signal Notifications</span>
                <span className="text-[10px] text-[#9CA3AF] block">
                  Alerts when model expected value (EV) exceeds hurdle rate.
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 font-bold text-[10px] uppercase">
              Active
            </span>
          </div>

          <div className="pt-3 border-t border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-[#9CA3AF]" />
              <div>
                <span className="text-white font-bold block">Data Privacy &amp; Security</span>
                <span className="text-[10px] text-[#9CA3AF] block">
                  Encrypted session credentials and Supabase row-level security.
                </span>
              </div>
            </div>
            <span className="text-neutral-400 text-[11px]">Protected</span>
          </div>
        </div>
      </section>
    </div>
  );
}