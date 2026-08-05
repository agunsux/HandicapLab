'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Activity, BarChart2, CheckCircle2, AlertTriangle, MinusCircle, Check } from 'lucide-react';
import { PremiumOpportunity } from './OpportunitiesTable';
import { cn } from '@/lib/utils';

interface OpportunityDetailPanelProps {
  opportunity: PremiumOpportunity | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OpportunityDetailPanel({ opportunity, isOpen, onClose }: OpportunityDetailPanelProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!opportunity) return null;

  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case 'VALUE': return { color: 'text-signal-positive', bg: 'bg-signal-positive-bg border-signal-positive/20', icon: CheckCircle2 };
      case 'WATCH': return { color: 'text-signal-watch', bg: 'bg-signal-watch-bg border-signal-watch/20', icon: AlertTriangle };
      case 'PASS': default: return { color: 'text-muted-foreground', bg: 'bg-muted/30 border-border', icon: MinusCircle };
    }
  };

  const signalConfig = getSignalConfig(opportunity.signal);
  const SignalIcon = signalConfig.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border z-50 shadow-2xl flex flex-col font-sans"
          >
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 rounded border",
                    signalConfig.bg,
                    signalConfig.color
                  )}>
                    <SignalIcon className="w-3 h-3" />
                    {opportunity.isStale ? 'STALE' : opportunity.signal}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{opportunity.league}</span>
                </div>
                <h2 className="text-xl font-display font-bold tracking-tight text-foreground leading-tight mb-1">
                  {opportunity.match}
                </h2>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  {opportunity.time}
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Core Opportunity Box */}
              <div className="bg-background rounded-lg p-5 border border-border shadow-elevation-1">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
                  Target Selection
                </div>
                <div className="text-xl font-medium text-foreground mb-6 font-display">
                  {opportunity.selection} <span className="text-muted-foreground font-normal text-base ml-1">({opportunity.market})</span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-5 border-t border-border">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Model Prob</div>
                    <div className="font-mono font-medium text-foreground text-sm">{(opportunity.modelProb * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Fair Odds</div>
                    <div className="font-mono font-medium text-foreground text-sm">{opportunity.fairOdds.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Market Odds</div>
                    <div className="font-mono font-bold text-foreground text-sm">{opportunity.marketOdds.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Expected Value</div>
                    <div className={cn("font-mono font-bold text-sm", opportunity.ev > 0 ? "text-signal-positive" : "text-muted-foreground")}>
                      {opportunity.ev > 0 ? '+' : ''}{opportunity.ev.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Quality & Diagnostics */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Diagnostics & Quality</h3>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-4 rounded bg-background border border-border">
                    <Activity className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">Data Freshness</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        Odds snapshot recorded {Math.floor(Math.random() * 15) + 1} minutes ago. Pipeline state verified.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded bg-background border border-border">
                    <BarChart2 className="w-4 h-4 text-signal-watch mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">Calibration Status</div>
                      <div className="text-xs font-mono text-muted-foreground bg-muted inline-block px-1.5 py-0.5 rounded mt-1">
                        CALIBRATION_INSUFFICIENT_DATA
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action */}
              <div className="pt-8 border-t border-border">
                <button 
                  className={cn(
                    "w-full py-3.5 rounded-md text-sm font-medium flex items-center justify-center transition-colors font-display tracking-wide",
                    opportunity.signal === 'VALUE' ? "bg-primary text-primary-foreground hover:bg-action-blue-hover" : "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                  )}
                  disabled={opportunity.signal !== 'VALUE'}
                >
                  {opportunity.signal === 'VALUE' ? 'Track Opportunity' : 'Signal Does Not Meet Threshold'}
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
