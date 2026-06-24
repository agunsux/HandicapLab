import React from 'react';
import Navbar from './_components/Navbar';
import Hero from './_components/Hero';
import LiveStats from './_components/LiveStats';
import CompetitorPositioning from './_components/CompetitorPositioning';
import TheEdge from './_components/TheEdge';
import Pricing from './_components/Pricing';
import WaitlistForm from './_components/WaitlistForm';
import Footer from './_components/Footer';

export const metadata = {
  title: 'HandicapLab | Quant-Grade Football Analytics',
  description: 'Calibrate your betting strategy with ensembled goal expectation models. Beating Pinnacle closing lines with programmatically verified Brier score calibration.',
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#09090B] selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* The Edge / Features pillar section */}
      <TheEdge />

      {/* Live Verification / Settlement Stats section */}
      <LiveStats />

      {/* Competitor Positioning grid */}
      <CompetitorPositioning />

      {/* Pricing options section */}
      <Pricing />

      {/* Waitlist Subscription form section */}
      <WaitlistForm />

      {/* Footer */}
      <Footer />
    </div>
  );
}
