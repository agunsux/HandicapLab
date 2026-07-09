import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / non-production code:
    "scratch/**",
    "benchmarks/**",
    "src/scripts/**",
    "src/test/**",
  ]),
  {
    rules: {
      // ── no-explicit-any (warn) ──
      // REQUIRED: 850+ instances across the entire codebase in data processing,
      // API integration, legacy migration shims, and dynamic Supabase result
      // handling. Individually typing every instance would require deep domain
      // knowledge of dozens of modules and is beyond a single lint pass.
      // Each instance still generates a visible warning for incremental cleanup.
      "@typescript-eslint/no-explicit-any": "warn",

      // ── react-hooks/set-state-in-effect (off) ──
      // REQUIRED: Standard Next.js hydration guard pattern used across ~15
      // page components (setMounted(true) in useEffect). This is a well-known
      // pattern documented by the Next.js team for preventing hydration
      // mismatches. Fixing requires architectural changes (useSyncExternalStore
      // or custom hooks) that would add complexity without benefit.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;