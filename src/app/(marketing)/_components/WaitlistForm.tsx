'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Check, ShieldCheck } from 'lucide-react';

interface WelcomeEmail {
  id: number;
  subject: string;
  body: string;
}

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [welcomeFlow, setWelcomeFlow] = useState<WelcomeEmail[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleLeague = (league: string) => {
    setSelectedLeagues(prev =>
      prev.includes(league) ? prev.filter(l => l !== league) : [...prev, league]
    );
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev =>
      prev.includes(market) ? prev.filter(m => m !== market) : [...prev, market]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          leagues: selectedLeagues,
          markets: selectedMarkets
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsSubmitted(true);
        setWelcomeFlow(data.welcomeFlow || []);
      } else {
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
                className="space-y-8"
              >
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-widest block">
                    Lead Generation & Onboarding
                  </span>
                  <h2 className="text-3xl font-extrabold text-zinc-100 tracking-tight">
                    Subscribe for Free Market Insights
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl font-sans">
                    Register below to join the next analytics cohort. We send model verification performance statistics and ensembled value alerts.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider block">Email Address</label>
                    <div className="relative max-w-md">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-650" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="analyst@firm.com"
                        className="w-full pl-10 pr-4 py-3 bg-[#09090B] border border-white/[0.05] rounded-lg text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors font-sans"
                      />
                    </div>
                    {errorMsg && <p className="text-rose-400 text-xs mt-1 font-mono">{errorMsg}</p>}
                  </div>

                  {/* League Preferences */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider block">Preferred Leagues</label>
                    <div className="flex flex-wrap gap-2">
                      {['English Premier League', 'World Cup 2026', 'La Liga', 'Champions League'].map((league) => {
                        const active = selectedLeagues.includes(league);
                        return (
                          <button
                            key={league}
                            type="button"
                            onClick={() => toggleLeague(league)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition border ${
                              active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold'
                                : 'bg-[#09090B] text-zinc-500 border-white/[0.05] hover:text-zinc-350'
                            }`}
                          >
                            {league}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Favorite Markets */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider block">Favorite Markets</label>
                    <div className="flex flex-wrap gap-2">
                      {['Asian Handicap', 'Over/Under Goals', 'Moneyline 1X2'].map((market) => {
                        const active = selectedMarkets.includes(market);
                        return (
                          <button
                            key={market}
                            type="button"
                            onClick={() => toggleMarket(market)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition border ${
                              active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold'
                                : 'bg-[#09090B] text-zinc-500 border-white/[0.05] hover:text-zinc-350'
                            }`}
                          >
                            {market}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-[#09090B] font-bold text-sm tracking-wide transition-all hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {submitting ? (
                        <span className="h-4 w-4 border-2 border-[#09090B] border-t-transparent animate-spin rounded-full" />
                      ) : (
                        'Secure Free Access & Subscribe'
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
                className="space-y-8 flex flex-col items-center justify-center"
              >
                <div className="text-center space-y-4 flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-zinc-100">Lead Registered Successfully</h3>
                    <p className="text-zinc-400 text-sm max-w-md font-sans">
                      Thank you for registering <span className="text-zinc-200 font-semibold">{email}</span>. You will receive ensembled forecasts based on your preferences.
                    </p>
                  </div>
                </div>

                {/* Email campaign preview list */}
                <div className="w-full max-w-xl space-y-3.5 pt-4 border-t border-slate-900">
                  <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest block text-center">
                    Welcome Flow Campaign Scheduled
                  </span>
                  
                  <div className="space-y-3">
                    {welcomeFlow.map((mail, index) => (
                      <div key={mail.id} className="bg-[#09090B] border border-white/[0.03] p-4 rounded-lg space-y-2 hover:border-slate-800 transition-colors">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-450 font-bold">Email #{index + 1}</span>
                          <span className="text-slate-600">Pending Send</span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-200">{mail.subject}</h4>
                        <p className="text-[11px] text-slate-500 leading-normal font-sans">{mail.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
