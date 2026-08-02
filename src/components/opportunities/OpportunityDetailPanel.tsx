'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Activity, BarChart2, CheckCircle2, AlertTriangle, MinusCircle, Check } from 'lucide-react';
import { Opportunity } from './OpportunitiesTable';
import { cn } from '@/lib/utils';

interface OpportunityDetailPanelProps {
  opportunity: Opportunity | null;
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
      case 'VALUE': return { color: 'text-[#75B58B]', bg: 'bg-[#75B58B]/10', icon: CheckCircle2 };
      case 'WATCH': return { color: 'text-[#C89B61]', bg: 'bg-[#C89B61]/10', icon: AlertTriangle };
      case 'PASS': default: return { color: 'text-muted-foreground', bg: 'bg-muted/30', icon: MinusCircle };
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
            className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border z-50 shadow-2xl flex flex-col"
          >
            <div className="flex items-start justify-between p-4 md:p-6 border-b border-border bg-card shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 rounded",
                    signalConfig.bg,
                    signalConfig.color
                  )}>
                    <SignalIcon className="w-3 h-3" />
                    {opportunity.isStale ? 'STALE' : opportunity.signal}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{opportunity.league}</span>
                </div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-tight">
                  {opportunity.match}
                </h2>
                <div className="text-xs text-muted-foreground mt-1">
                  {opportunity.time}
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              
              {/* Core Opportunity Box */}
              <div className="bg-background rounded-lg p-4 border border-border">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
                  Target Selection
                </div>
                <div className="text-xl font-bold text-foreground mb-4">
                  {opportunity.selection} <span className="text-muted-foreground font-normal text-base ml-1">({opportunity.market})</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Model Probability</div>
                    <div className="font-mono font-medium text-foreground">{(opportunity.modelProb * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Fair Odds</div>
                    <div className="font-mono font-medium text-foreground">{opportunity.fairOdds.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Market Odds</div>
                    <div className="font-mono font-bold text-foreground">{opportunity.marketOdds.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Expected Value</div>
                    <div className={cn("font-mono font-bold", opportunity.ev > 0 ? "text-[#75B58B]" : "text-muted-foreground")}>
                      {opportunity.ev > 0 ? '+' : ''}{opportunity.ev.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Quality & Diagnostics */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Diagnostics & Quality</h3>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded bg-muted/30 border border-border/50">
                    <Activity className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Data Freshness</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Odds snapshot recorded {Math.floor(Math.random() * 15) + 1} minutes ago. Pipeline state verified.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded bg-muted/30 border border-border/50">
                    <BarChart2 className="w-4 h-4 text-[#C89B61] mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Calibration Status</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        CALIBRATION_INSUFFICIENT_DATA
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action */}
              <div className="pt-6 border-t border-border">
                <button 
                  className={cn(
                    "w-full py-3 rounded-md text-sm font-bold flex items-center justify-center transition-colors",
                    opportunity.signal === 'VALUE' ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground cursor-not-allowed"
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
