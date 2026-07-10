// Color tokens — semantic naming, not literal
export const colors = {
  // Confidence scale (0-100)
  confidence: {
    veryHigh: '#16a34a',   // green-600
    high: '#22c55e',       // green-500
    moderate: '#eab308',   // yellow-500
    low: '#f97316',        // orange-500
    veryLow: '#ef4444',    // red-500
  },
  // Market Quality scale
  marketQuality: {
    excellent: '#16a34a',
    good: '#22c55e',
    neutral: '#6b7280',    // gray-500
    avoid: '#ef4444',
  },
  // Status
  status: {
    healthy: '#16a34a',
    degraded: '#f97316',
    critical: '#ef4444',
    unknown: '#6b7280',
  },
  // Semantic
  primary: '#3b82f6',      // blue-500
  background: '#0f172a',   // slate-900
  surface: '#1e293b',      // slate-800
  surfaceAlt: '#334155',   // slate-700
  border: '#475569',       // slate-600
  text: '#f8fafc',         // slate-50
  textSecondary: '#94a3b8',// slate-400
  textMuted: '#64748b',    // slate-500
  success: '#16a34a',
  warning: '#eab308',
  error: '#ef4444',
} as const;

// Spacing
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
} as const;

// Typography
export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '"SF Mono", "Fira Code", "Fira Mono", monospace',
  sizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// Border radius
export const borderRadius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 6px rgba(0,0,0,0.3)',
  lg: '0 10px 15px rgba(0,0,0,0.3)',
} as const;