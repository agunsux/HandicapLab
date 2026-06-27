'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ChevronRight } from 'lucide-react';

export default function Navbar() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#09090B]/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 font-bold text-[#09090B] text-lg tracking-tight">
            H
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-zinc-100">
              Handicap<span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Lab</span>
            </span>
            <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">Quant Intelligence</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <Link href="/scanner" className="hover:text-zinc-100 transition-colors">
            Edge Scanner
          </Link>
          <Link href="/competitions" className="hover:text-zinc-100 transition-colors">
            Competitions
          </Link>
          <Link href="/teams" className="hover:text-zinc-100 transition-colors">
            Teams
          </Link>
          <Link href="/performance" className="hover:text-zinc-100 transition-colors">
            Performance
          </Link>
          <Link href="/pricing" className="hover:text-zinc-100 transition-colors">
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="hover:text-zinc-100 transition-colors flex items-center gap-1 font-mono text-xs bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Access Ledger
          </Link>
        </nav>

        {/* CTA Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => scrollToSection('waitlist')}
            className="group relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2 text-xs font-semibold text-[#09090B] transition-all hover:opacity-95"
          >
            Join Waitlist
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
