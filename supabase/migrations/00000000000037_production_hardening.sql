-- Create missing indexes for query optimizations
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.signals(created_at);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_signal_id ON public.odds_snapshots(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_signal_id ON public.signal_events(signal_id);
