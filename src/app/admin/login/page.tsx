'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If cookie is already set and valid, check and auto-redirect
    const match = document.cookie.match(/(^| )admin_secret=([^;]+)/);
    if (match && match[2]) {
      const redirectPath = searchParams.get('redirect') || '/admin';
      router.push(redirectPath);
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) {
      setError('Please enter the admin secret key.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate via a lightweight check against the data-health endpoint or direct validation
      const res = await fetch('/api/admin/data-health', {
        headers: {
          'x-admin-secret': secret,
        },
      });

      if (res.status === 200) {
        // Set the secure cookie
        // Use path=/ so it's accessible across all paths under the domain
        document.cookie = `admin_secret=${encodeURIComponent(
          secret
        )}; path=/; max-age=86400; SameSite=Strict; Secure`;

        // Redirect to intended path or fallback to /admin
        const redirectPath = searchParams.get('redirect') || '/admin';
        router.push(redirectPath);
        router.refresh();
      } else {
        setError('Invalid admin secret key.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="secret" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Passcode Secret
        </label>
        <input
          id="secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="••••••••••••••••"
          className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-center tracking-widest font-mono"
          autoFocus
        />
      </div>

      {error && (
        <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-center animate-shake">
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white font-medium text-sm transition-all duration-300 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          'Authenticate Access'
        )}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 to-black text-slate-100 p-6 font-sans">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1508847154043-be12a62861c1?q=80&w=1920')] bg-cover bg-center opacity-10 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 transition-all duration-300 hover:shadow-indigo-500/5">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white font-black text-xl mb-4 shadow-lg shadow-indigo-500/20">
            HL
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">HandicapLab Admin</h1>
          <p className="text-sm text-slate-400 mt-2">
            Football Market Intelligence Platform
          </p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-6">
            <span className="w-6 h-6 border-2 border-white/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        }>
          <AdminLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
