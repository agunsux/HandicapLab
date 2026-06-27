import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://placeholder-key@o0.ingest.sentry.io/placeholder-project",
  
  // Define how likely traces are sampled. Adjust in production as needed.
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console when Sentry is initialized.
  debug: false,
});
