import React from 'react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      aria-label="HandicapLab Logo"
    >
      <path
        d="M20,75 L35,25 L48,25 L42,45 L58,45 L64,25 L77,25 L62,75 L49,75 L55,55 L39,55 L33,75 Z"
        fill="currentColor"
      />
      <path
        d="M55,55 L49,75 L85,75 L89,62 L66,62 L73,38 L86,38 L82,51 Z"
        fill="var(--signal-high, #4CAF7A)"
      />
      <path d="M50,30 A15,15 0 0,0 35,45 A15,15 0 0,0 50,60 A15,15 0 0,0 65,45 A15,15 0 0,0 50,30 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <polygon points="50,35 53,42 60,42 54,47 56,54 50,50 44,54 46,47 40,42 47,42" fill="currentColor" />
    </svg>
  );
}
