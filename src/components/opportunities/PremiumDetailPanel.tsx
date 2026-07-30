'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, History, Activity, BarChart3, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Opportunity } from './OpportunitiesTable';

interface PremiumDetailPanelProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumDetailPanel({ opportunity, isOpen, onClose }: PremiumDetailPanelProps) {
  // Prevent body scroll when drawer is open
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

  return (
    <AnimatePresence>
      {isOpen && opportunity && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border z-50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="premium" className="bg-premium-gold/20 text-premium-gold border-premium-gold/30 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="size-3" />
                    Verified Edge
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">{opportunity.league}</span>
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{opportunity.match}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted shrink-0">
                <X className="size-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Highlight Box */}
              <div className="bg-background rounded-xl p-5 border border-border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Recommendation</div>
                <div className="text-xl font-semibold mb-4">{opportunity.selection} <span className="text-muted-foreground font-normal text-base">({opportunity.market})</span></div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Odds</div>
                    <div className="font-mono font-semibold">{opportunity.odds}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Fair Odds</div>
                    <div className="font-mono font-medium text-muted-foreground">{opportunity.fairOdds}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Edge</div>
                    <div className="font-mono font-bold text-primary">+{opportunity.edge}%</div>
                  </div>
                </div>
              </div>

              {/* Evidence Sections */}
              <div className="space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Why this opportunity?</h3>
                
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <div className="mt-0.5 bg-primary/10 p-2 rounded-lg shrink-0">
                      <BarChart3 className="size-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Model Probability</h4>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Our model calculates a 58.2% true probability for this outcome, significantly higher than the 52.6% implied by current bookmaker odds.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-0.5 bg-secondary/10 p-2 rounded-lg shrink-0">
                      <TrendingUp className="size-4 text-secondary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Market Movement</h4>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Sharp money has moved the Pinnacle opening line from 2.05 to 1.95, indicating professional agreement with our model's direction.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-0.5 bg-accent/10 p-2 rounded-lg shrink-0">
                      <History className="size-4 text-accent-foreground" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Historical Similar Bets</h4>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Historically, bets matching this exact profile (A-grade edge, positive market movement) have yielded a +8.4% ROI over 450+ tracked matches.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="mt-0.5 bg-muted p-2 rounded-lg shrink-0">
                      <Activity className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Injury Summary</h4>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Key absences for the opposition (starting CB and defensive midfielder) significantly increase expected goals (xG) for this selection.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border bg-card">
              <Button className="w-full font-medium" variant="secondary">
                View Full Analysis <ChevronRight className="ml-2 size-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Advanced analytics (Calibration, Brier Score, CLV) are hidden by default to keep decisions fast.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Simple internal Badge component to avoid importing missing variants if UI badge doesn't have them
function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`inline-flex items-center ${className}`} {...props}>{children}</div>;
}
