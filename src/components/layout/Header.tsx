import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="size-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold tracking-tighter">
              HL
            </div>
            <span className="font-semibold text-lg tracking-tight hidden sm:inline-block">HandicapLab</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/live" className="transition-colors hover:text-foreground">Live Edges</Link>
            <Link href="/markets" className="transition-colors hover:text-foreground">Markets</Link>
            <Link href="/results" className="transition-colors hover:text-foreground">Results</Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
            <Link href="/learn" className="transition-colors hover:text-foreground">Learn</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Search">
            <Search className="size-5" />
          </button>
          
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Button asChild className="rounded-full px-6 font-semibold">
              <Link href="/pricing">Start Free</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
