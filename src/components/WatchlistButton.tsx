'use client';

import { useState, useEffect } from 'react';

interface WatchlistButtonProps {
  matchId: string;
}

export function WatchlistButton({ matchId }: WatchlistButtonProps) {
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const getWatchlist = (): string[] => {
      try {
        const item = localStorage.getItem('handicaplab_watchlist');
        return item ? JSON.parse(item) : [];
      } catch {
        return [];
      }
    };

    const watchlist = getWatchlist();
    setIsWatchlisted(watchlist.includes(matchId));

    const handleWatchlistChange = () => {
      const updatedList = getWatchlist();
      setIsWatchlisted(updatedList.includes(matchId));
    };

    window.addEventListener('storage', handleWatchlistChange);
    window.addEventListener('handicaplab_watchlist_changed', handleWatchlistChange);

    return () => {
      window.removeEventListener('storage', handleWatchlistChange);
      window.removeEventListener('handicaplab_watchlist_changed', handleWatchlistChange);
    };
  }, [matchId]);

  const toggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const item = localStorage.getItem('handicaplab_watchlist');
      let watchlist: string[] = item ? JSON.parse(item) : [];

      if (watchlist.includes(matchId)) {
        watchlist = watchlist.filter((id) => id !== matchId);
      } else {
        watchlist.push(matchId);
      }

      localStorage.setItem('handicaplab_watchlist', JSON.stringify(watchlist));
      setIsWatchlisted(watchlist.includes(matchId));
      
      // Dispatch custom event to notify other components on the page
      window.dispatchEvent(new Event('handicaplab_watchlist_changed'));
    } catch (err) {
      console.error('Failed to update watchlist:', err);
    }
  };

  if (!mounted) {
    return (
      <button className="p-1.5 rounded-lg border border-slate-800 text-slate-600 hover:text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
    );
  }

  return (
    <button
      onClick={toggleWatchlist}
      title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
      className={`p-1.5 rounded-lg border transition-all ${
        isWatchlisted
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isWatchlisted ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-star"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
