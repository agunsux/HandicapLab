'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMatches, getPredictionsForMatch } from '@/lib/mock-data';
import Link from 'next/link';

export default function MatchScanner() {
  const allMatches = useMemo(() => getMatches(), []);

  // Filter & Sort States
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [minEdge, setMinEdge] = useState('0'); // 0%, 3%, 5%, 10%
  const [sortBy, setSortBy] = useState('time'); // 'time', 'ah-edge', 'ou-edge', 'confidence'

  // Leagues available in data
  const leagues = useMemo(() => {
    const set = new Set(allMatches.map((m) => m.league));
    return ['all', ...Array.from(set)];
  }, [allMatches]);

  // Combined matches + predictions data
  const enrichedMatches = useMemo(() => {
    return allMatches.map((match) => {
      const pred = getPredictionsForMatch(match.id);
      return {
        ...match,
        pred,
      };
    });
  }, [allMatches]);

  // Filtered & Sorted results
  const filteredMatches = useMemo(() => {
    let result = [...enrichedMatches];

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.homeTeam?.name.toLowerCase().includes(term) ||
          m.awayTeam?.name.toLowerCase().includes(term)
      );
    }

    // League filter
    if (leagueFilter !== 'all') {
      result = result.filter((m) => m.league === leagueFilter);
    }

    // Edge filter
    const edgeLimit = parseFloat(minEdge);
    if (edgeLimit > 0) {
      result = result.filter((m) => {
        if (!m.pred) return false;
        return (
          m.pred.handicapEdgePercent >= edgeLimit ||
          m.pred.ouEdgePercent >= edgeLimit
        );
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
      }
      if (sortBy === 'ah-edge') {
        const edgeA = a.pred?.handicapEdgePercent || 0;
        const edgeB = b.pred?.handicapEdgePercent || 0;
        return edgeB - edgeA;
      }
      if (sortBy === 'ou-edge') {
        const edgeA = a.pred?.ouEdgePercent || 0;
        const edgeB = b.pred?.ouEdgePercent || 0;
        return edgeB - edgeA;
      }
      if (sortBy === 'confidence') {
        const confA = a.pred?.confidenceScore || 0;
        const confB = b.pred?.confidenceScore || 0;
        return confB - confA;
      }
      return 0;
    });

    return result;
  }, [enrichedMatches, search, leagueFilter, minEdge, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">Market Match Scanner</h1>
        <p className="text-slate-400 text-sm mt-1">
          Scan global football matches, set edge thresholds, and filter value opportunities.
        </p>
      </div>

      {/* Filter Control Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Search Teams</label>
            <Input
              type="text"
              placeholder="e.g. Liverpool"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/30"
            />
          </div>

          {/* League Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">League</label>
            <Select value={leagueFilter} onValueChange={(val) => setLeagueFilter(val || 'all')}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/30">
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {leagues.map((league) => (
                  <SelectItem key={league} value={league} className="hover:bg-slate-800 focus:bg-slate-800 text-slate-300">
                    {league === 'all' ? 'All Leagues' : league}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min Edge Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Minimum Model Edge</label>
            <Select value={minEdge} onValueChange={(val) => setMinEdge(val || '0')}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/30">
                <SelectValue placeholder="Any Edge" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="0" className="hover:bg-slate-800 focus:bg-slate-800">Any Edge (0%+)</SelectItem>
                <SelectItem value="3" className="hover:bg-slate-800 focus:bg-slate-800">Value Edge (3%+)</SelectItem>
                <SelectItem value="5" className="hover:bg-slate-800 focus:bg-slate-800">Strong Edge (5%+)</SelectItem>
                <SelectItem value="10" className="hover:bg-slate-800 focus:bg-slate-800">Premium Edge (10%+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Sort Results By</label>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val || 'time')}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/30">
                <SelectValue placeholder="Kickoff Time" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="time" className="hover:bg-slate-800 focus:bg-slate-800">Kickoff Time</SelectItem>
                <SelectItem value="ah-edge" className="hover:bg-slate-800 focus:bg-slate-800">Asian Handicap Edge</SelectItem>
                <SelectItem value="ou-edge" className="hover:bg-slate-800 focus:bg-slate-800">Over/Under Edge</SelectItem>
                <SelectItem value="confidence" className="hover:bg-slate-800 focus:bg-slate-800">Confidence Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scanner List table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          {filteredMatches.length > 0 ? (
            <Table>
              <TableHeader className="border-b border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-800">
                  <TableHead className="text-slate-400 font-mono text-xs pl-6">League & Schedule</TableHead>
                  <TableHead className="text-slate-400 font-mono text-xs">Fixture</TableHead>
                  <TableHead className="text-slate-400 font-mono text-xs text-center">Asian Handicap</TableHead>
                  <TableHead className="text-slate-400 font-mono text-xs text-center">Over/Under Goals</TableHead>
                  <TableHead className="text-slate-400 font-mono text-xs text-center">Moneyline Probability</TableHead>
                  <TableHead className="text-slate-400 font-mono text-xs text-center">Confidence</TableHead>
                  <TableHead className="text-slate-400 font-mono text-xs text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map((m) => {
                  if (!m.pred) return null;
                  
                  return (
                    <TableRow key={m.id} className="hover:bg-slate-850/40 border-slate-800/60">
                      {/* League/Schedule */}
                      <TableCell className="py-4 pl-6">
                        <div className="flex flex-col text-xs font-mono">
                          <span className="text-slate-300 font-medium">{m.league}</span>
                          <span className="text-slate-500 mt-1" suppressHydrationWarning>
                            {new Date(m.kickoffTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            {new Date(m.kickoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </TableCell>

                      {/* Fixture */}
                      <TableCell className="py-4 font-semibold text-white">
                        {m.homeTeam?.name} <span className="text-slate-500 font-normal">v</span> {m.awayTeam?.name}
                      </TableCell>

                      {/* Asian Handicap */}
                      <TableCell className="text-center py-4 font-mono">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xs text-slate-300">
                            Line: {m.pred.handicapLine > 0 ? `+${m.pred.handicapLine}` : m.pred.handicapLine}
                          </span>
                          <Badge className={`mt-1 font-bold ${m.pred.handicapEdgePercent > 5 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                            Edge: {m.pred.handicapEdgePercent > 0 ? `+${m.pred.handicapEdgePercent}%` : `${m.pred.handicapEdgePercent}%`}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Over/Under */}
                      <TableCell className="text-center py-4 font-mono">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xs text-slate-300">
                            Line: Over {m.pred.totalLine}
                          </span>
                          <Badge className={`mt-1 font-bold ${m.pred.ouEdgePercent > 5 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                            Edge: {m.pred.ouEdgePercent > 0 ? `+${m.pred.ouEdgePercent}%` : `${m.pred.ouEdgePercent}%`}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Moneyline Prob */}
                      <TableCell className="text-center py-4 font-mono text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className="bg-slate-950 px-1 py-0.5 rounded text-slate-300 border border-slate-800">
                            {Math.round(m.pred.homeProbability * 100)}%
                          </span>
                          <span className="text-slate-700">•</span>
                          <span className="bg-slate-950 px-1 py-0.5 rounded text-slate-400 border border-slate-800">
                            {Math.round(m.pred.drawProbability * 100)}%
                          </span>
                          <span className="text-slate-700">•</span>
                          <span className="bg-slate-950 px-1 py-0.5 rounded text-slate-300 border border-slate-800">
                            {Math.round(m.pred.awayProbability * 100)}%
                          </span>
                        </div>
                      </TableCell>

                      {/* Confidence */}
                      <TableCell className="text-center py-4 font-mono">
                        <span className="font-semibold text-white">{m.pred.confidenceScore}/100</span>
                      </TableCell>

                      <TableCell className="text-right py-4 pr-6">
                        <button disabled className="px-3.5 py-1.5 rounded bg-slate-800 text-slate-500 font-bold text-xs tracking-tight cursor-not-allowed">
                          Analyze
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <div className="text-sm">No matches found matching your filters.</div>
              <button
                onClick={() => {
                  setSearch('');
                  setLeagueFilter('all');
                  setMinEdge('0');
                  setSortBy('time');
                }}
                className="text-xs text-emerald-400 underline"
              >
                Reset Scanner Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
