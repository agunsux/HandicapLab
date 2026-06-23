'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mail, User, ShieldCheck } from 'lucide-react';

export default function WaitlistForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTier, setSelectedTier] = useState('Pro Trader');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setSubmitting(true);

    // Simulate database waitlist ingestion
    setTimeout(() => {
      setSubmitting(false);
      setIsSubmitted(true);
    }, 1000);
  };

  return (
    <section id="waitlist" className="py-24 border-t border-white/[0.05] bg-[#0c0c0e] relative">
      <div className="absolute top-[-10%] left-[10%] h-[300px] w-[300px] rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />

      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-xl border border-white/[0.05] bg-[#121215] p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/5 blur-2xl rounded-full" />
          
          <AnimatePresence mode="wait">
            {!isSubmitted ? (
              <motion.div
                key="form-container"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-widest block">
                    EXCLUSIVE ONBOARDING PHASE
                  </span>
                  <h2 className="text-3xl font-extrabold text-zinc-100 tracking-tight">
                    Secure Your Position on the Ledger
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl font-sans">
                    Due to liquidity limits and model API capacity, we onboarding select members in cohorts. Register your email below to secure a position in the next deployment cycle.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Warren Buffet"
                          className="w-full pl-10 pr-4 py-3 bg-[#09090B] border border-white/[0.05] rounded-lg text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-sans"
                        />
                      </div>
                    </div>

                    {/* Email Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="warren@berkshire.com"
                          className="w-full pl-10 pr-4 py-3 bg-[#09090B] border border-white/[0.05] rounded-lg text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tier Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Preferred Access Tier</label>
                    <div className="flex flex-wrap gap-3">
                      {['Free Sandbox', 'Pro Trader', 'Elite Institutional'].map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setSelectedTier(tier)}
                          className={`px-4 py-2.5 rounded-lg text-xs font-mono font-semibold transition border ${
                            selectedTier === tier
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-[#09090B] text-zinc-500 border-white/[0.05] hover:text-zinc-300'
                          }`}
                        >
                          {tier}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-[#09090B] font-bold text-sm tracking-wide transition-all hover:opacity-95 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <span className="h-4 w-4 border-2 border-[#09090B] border-t-transparent animate-spin rounded-full" />
                      ) : (
                        'Request Access Code'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success-container"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-8 space-y-6 flex flex-col items-center justify-center"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-zinc-100">Waitlist Registered</h3>
                  <p className="text-zinc-400 text-sm max-w-md font-sans">
                    Welcome to the waitlist, <span className="text-zinc-200 font-semibold">{name}</span>. We will notify you at <span className="text-zinc-200 font-semibold">{email}</span> as soon as your cohort opens.
                  </p>
                </div>
                <div className="rounded bg-zinc-900 border border-zinc-800 px-4 py-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  YOUR ESTIMATED WAIT TIME: ~14 DAYS
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
