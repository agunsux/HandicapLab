import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border py-12 md:py-16 mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center space-x-2">
            <div className="size-6 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              HL
            </div>
            <span className="font-semibold tracking-tight text-foreground">HandicapLab</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} HandicapLab. All rights reserved.
          </p>
        </div>
        
        <div className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
        </div>
      </div>
    </footer>
  );
}
