'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FOOTER_NAV } from '@/config/navigation';
import { Moon, Sun, ArrowRight, Shield } from 'lucide-react';

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="border-t border-[#1F2937] bg-[#0B0F0E] text-[#F0FDF4] relative z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 max-w-7xl">
        {/* Top 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Column 1: Brand (30%) */}
          <div className="md:col-span-2 lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-[#10B981] flex items-center justify-center text-black font-display font-bold text-xs shadow-sm">
                HL
              </div>
              <span className="font-display font-semibold tracking-tight text-[#F0FDF4] text-base">
                Handicap<span className="text-[#10B981]">Lab</span>
              </span>
            </div>

            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              Trade the Edge. Not the Hype. Quantitative football market intelligence for Asian Handicap, Over/Under, Moneyline &amp; BTTS.
            </p>

            {/* Social Icons Row */}
            <div className="flex items-center gap-3 pt-2">
              {/* Twitter / X */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="h-8 w-8 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#10B981] hover:scale-110 transition-all duration-200"
                aria-label="Twitter / X"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* Discord */}
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                className="h-8 w-8 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#10B981] hover:scale-110 transition-all duration-200"
                aria-label="Discord"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .373-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>

              {/* Telegram */}
              <a
                href="https://telegram.org"
                target="_blank"
                rel="noreferrer"
                className="h-8 w-8 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#10B981] hover:scale-110 transition-all duration-200"
                aria-label="Telegram"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm5.262 7.174l-2.07 9.758c-.156.7-.567.87-1.155.54l-3.155-2.327-1.522 1.465c-.168.168-.31.31-.635.31l.226-3.21 5.845-5.28c.254-.226-.056-.35-.395-.125l-7.224 4.549-3.111-.973c-.677-.212-.691-.677.142-1.002l12.169-4.69c.564-.204 1.057.135.881.985z" />
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="h-8 w-8 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#10B981] hover:scale-110 transition-all duration-200"
                aria-label="YouTube"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Markets */}
          <div>
            <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF]/60 font-semibold mb-4">
              Markets
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/app/markets/asian-handicap" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Asian Handicap
                </Link>
              </li>
              <li>
                <Link href="/app/markets/over-under" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Over / Under
                </Link>
              </li>
              <li>
                <Link href="/app/markets/moneyline" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Moneyline (1X2)
                </Link>
              </li>
              <li>
                <Link href="/app/markets/btts" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  BTTS (Both Teams To Score)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h3 className="text-xs uppercase tracking-widest text-[#9CA3AF]/60 font-semibold mb-4">
              Company
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/methodology" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Methodology &amp; Math
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Pricing &amp; Plans
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Research Blog
                </Link>
              </li>
              <li>
                <Link href="/trust-center" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Trust Center
                </Link>
              </li>
              <li>
                <Link href="/validation" className="text-[#9CA3AF] hover:text-[#10B981] transition-colors">
                  Track Record Validation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Full-width Newsletter Section */}
        <div className="mt-12 border-t border-[#1F2937] pt-10 pb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6">
            <div>
              <h4 className="text-lg font-semibold text-[#F0FDF4] flex items-center gap-2">
                Get an edge.
              </h4>
              <p className="text-sm text-[#9CA3AF] mt-1">
                Weekly quantitative market insights and high-EV opportunity alerts. No spam.
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="bg-[#0B0F0E] border border-[#1F2937] rounded-lg px-4 py-2.5 text-sm text-[#F0FDF4] placeholder-[#9CA3AF]/60 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none w-full sm:w-80"
              />
              <button
                type="submit"
                className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 shadow-sm"
              >
                {subscribed ? 'Subscribed ✓' : <>Subscribe <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </div>
          <p className="text-xs text-[#9CA3AF]/60 mt-3 text-center sm:text-left">
            We respect your privacy. Unsubscribe anytime with one click.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-[#1F2937] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
          <div>
            &copy; 2026 HandicapLab. Research transparency, always.
          </div>

          <div className="flex items-center gap-6">
            <Link href="/methodology" className="hover:text-[#10B981] transition-colors">
              Methodology
            </Link>
            <Link href="/models" className="hover:text-[#10B981] transition-colors">
              Models
            </Link>
            <Link href="/track-record" className="hover:text-[#10B981] transition-colors">
              Track Record
            </Link>
          </div>
        </div>

        {/* Responsible Gambling Disclaimer */}
        <div className="mt-6 pt-4 border-t border-[#1F2937]/50 space-y-2">
          <p className="text-xs text-[#F59E0B]/90 font-medium">
            HandicapLab is a sports analytics research project. All content is for informational purposes only. Nothing on this site constitutes betting advice.
          </p>
          <p className="text-[11px] text-[#9CA3AF]/70 leading-relaxed max-w-5xl">
            If you or someone you know has a gambling problem, seek help. Gamble responsibly and only where legal. Pinnacle close prices serve as the ground truth for Closing Line Value (CLV) evaluation.
          </p>
        </div>
      </div>
    </footer>
  );
}
