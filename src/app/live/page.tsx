'use client';

import { useState } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';
import { PremiumDetailPanel } from '@/components/opportunities/PremiumDetailPanel';

// Extended mock data for the application page
const FULL_MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: '1', match: 'Arsenal vs Liverpool', league: 'Premier League', time: 'Today, 20:00', market: 'Asian Handicap', selection: 'Arsenal -0.5', bookmaker: 'Pinnacle', odds: '1.95', fairOdds: '1.82', edge: 7.1, confidence: 'A+' },
  { id: '2', match: 'Real Madrid vs Barcelona', league: 'La Liga', time: 'Today, 21:00', market: 'Total Goals', selection: 'Over 2.5', bookmaker: 'Pinnacle', odds: '1.85', fairOdds: '1.75', edge: 5.7, confidence: 'A' },
  { id: '3', match: 'Juventus vs AC Milan', league: 'Serie A', time: 'Tomorrow, 19:45', market: 'Match Odds', selection: 'Juventus', bookmaker: 'Pinnacle', odds: '2.20', fairOdds: '2.08', edge: 5.8, confidence: 'A' },
  { id: '4', match: 'Bayern Munich vs Dortmund', league: 'Bundesliga', time: 'Tomorrow, 18:30', market: 'Asian Handicap', selection: 'Dortmund +1.5', bookmaker: 'Pinnacle', odds: '1.78', fairOdds: '1.71', edge: 4.1, confidence: 'B+' },
  { id: '5', match: 'PSG vs Lyon', league: 'Ligue 1', time: 'Sun, 20:00', market: 'Total Goals', selection: 'Under 3.5', bookmaker: 'Pinnacle', odds: '1.65', fairOdds: '1.58', edge: 4.4, confidence: 'B+' },
  { id: '6', match: 'Chelsea vs Man Utd', league: 'Premier League', time: 'Sun, 16:30', market: 'Match Odds', selection: 'Draw', bookmaker: 'Pinnacle', odds: '3.40', fairOdds: '3.15', edge: 7.9, confidence: 'A+' },
  { id: '7', match: 'Inter vs Roma', league: 'Serie A', time: 'Sun, 14:00', market: 'Both Teams to Score', selection: 'Yes', bookmaker: 'Pinnacle', odds: '1.91', fairOdds: '1.85', edge: 3.2, confidence: 'B' },
  { id: '8', match: 'Ajax vs PSV', league: 'Eredivisie', time: 'Sun, 12:15', market: 'Asian Handicap', selection: 'Ajax -1.0', bookmaker: 'Pinnacle', odds: '2.10', fairOdds: '1.98', edge: 6.1, confidence: 'A' },
];

export default function LiveEdgesPage() {
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  return (
    <div className="flex-1 flex flex-col bg-background">
      
      {/* Subheader / Toolbar */}
      <div className="border-b border-border bg-card sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <h1 className="text-xl font-bold tracking-tight shrink-0">Live Edges</h1>
            <div className="h-4 w-px bg-border hidden sm:block"></div>
            <span className="text-sm text-muted-foreground hidden sm:block">42 Opportunities found</span>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Search teams or leagues..." 
                className="pl-9 h-9 bg-background border-border text-sm w-full focus-visible:ring-primary/30"
              />
            </div>
            <Button variant="outline" size="sm" className="h-9 border-border bg-background gap-2 shrink-0">
              <Filter className="size-4" />
              <span className="hidden sm:inline">Filter</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
        {/* Quick Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <Button variant="secondary" size="sm" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shrink-0">All Edges (42)</Button>
          <Button variant="outline" size="sm" className="rounded-full border-border bg-card hover:bg-muted shrink-0">A+ Grade Only</Button>
          <Button variant="outline" size="sm" className="rounded-full border-border bg-card hover:bg-muted shrink-0">Premier League</Button>
          <Button variant="outline" size="sm" className="rounded-full border-border bg-card hover:bg-muted shrink-0">Asian Handicap</Button>
          <Button variant="outline" size="sm" className="rounded-full border-border bg-card hover:bg-muted shrink-0">Pinnacle Only</Button>
        </div>

        {/* High-density Table */}
        <div className="flex-1 mb-8">
          <OpportunitiesTable 
            data={FULL_MOCK_OPPORTUNITIES} 
            onRowClick={(opp) => setSelectedOpportunity(opp)} 
          />
        </div>

        {/* Pagination placeholder */}
        <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
          <span className="text-sm text-muted-foreground">Showing 1-8 of 42 edges</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled className="border-border">Previous</Button>
            <Button variant="outline" size="sm" className="border-border">Next</Button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <PremiumDetailPanel 
        opportunity={selectedOpportunity} 
        isOpen={!!selectedOpportunity} 
        onClose={() => setSelectedOpportunity(null)} 
      />
      
    </div>
  );
}
