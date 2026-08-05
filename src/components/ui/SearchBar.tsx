'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Command, Trophy, Users, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = [
    { type: 'team', title: 'Liverpool FC', category: 'Team • England', href: '/historical/teams/liverpool', icon: Users },
    { type: 'team', title: 'Manchester City', category: 'Team • England', href: '/historical/teams/mancity', icon: Users },
    { type: 'competition', title: 'Premier League (2023-24)', category: 'Competition • 380 Matches', href: '/historical/competitions/EPL', icon: Trophy },
    { type: 'match', title: 'Liverpool 2 - 1 Arsenal (15 Aug 2024)', category: 'Match • Premier League', href: '/historical/matches/hist-2024-001', icon: Calendar },
  ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || query === '');

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F2937] text-[#9CA3AF] hover:text-[#F0FDF4] hover:border-[#374151] transition-all text-xs w-64 justify-between"
      >
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-[#9CA3AF]" />
          <span>Search historical database...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium bg-[#1A1F2E] border border-[#1F2937] text-[#9CA3AF] rounded">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      {/* Spotlight Overlay Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div
            className="bg-[#111827] border border-[#1F2937] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Box */}
            <div className="flex items-center px-4 py-3 border-b border-[#1F2937] gap-3">
              <Search className="h-5 w-5 text-[#10B981]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a team, match, league, or xG stat..."
                className="flex-1 bg-transparent text-[#F0FDF4] placeholder-[#9CA3AF] text-sm focus:outline-none font-sans"
                autoFocus
              />
              <button onClick={() => setOpen(false)} className="text-[#9CA3AF] hover:text-[#F0FDF4] p-1 rounded-md">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results Container */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF]">
                Quick Results ({results.length})
              </div>
              {results.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9CA3AF]">No historical records found for "{query}"</div>
              ) : (
                results.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={idx}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-[#1A1F2E] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#10B981]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-[#F0FDF4] group-hover:text-[#10B981] transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-[#9CA3AF]">{item.category}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-[#0B0F0E] border-t border-[#1F2937] flex items-center justify-between text-[10px] text-[#9CA3AF] font-mono">
              <span>Search across 2,660 historical EPL matches</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
