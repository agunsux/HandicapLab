import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://placeholder-key@o0.ingest.sentry.io/placeholder-project",
  
  tracesSampleRate: 0.1,
  
  debug: false,
});
