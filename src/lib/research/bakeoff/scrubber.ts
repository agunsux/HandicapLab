/**
 * Secret Scrubber for Provider Audits
 * Enforces zero leak of FIVE_DOLLAR_API_KEY, DRIBBLE_API_KEY, and other sensitive tokens.
 */

export class SecretScrubber {
  private static sensitiveTokens: string[] = [];

  public static initialize(): void {
    const keys = [
      process.env.FIVE_DOLLAR_API_KEY,
      process.env.DRIBBLE_API_KEY,
      process.env.APIFOOTBALL_KEY,
      process.env.API_FOOTBALL_KEY,
      process.env.ODDS_PAPI_KEY,
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_SERVICE_KEY,
    ];

    this.sensitiveTokens = keys
      .filter((k): k is string => Boolean(k && k.trim().length > 3))
      .map((k) => k.trim());
  }

  public static registerSecret(token: string): void {
    if (token && token.trim().length > 3 && !this.sensitiveTokens.includes(token.trim())) {
      this.sensitiveTokens.push(token.trim());
    }
  }

  public static scrubText(text: string): string {
    if (!text) return text;
    let result = text;
    for (const token of this.sensitiveTokens) {
      if (token && token.length > 3) {
        result = result.split(token).join('[REDACTED_SECRET]');
      }
    }
    // Scrub common header patterns if any leaked
    result = result.replace(/x-api-key:\s*[^\r\n]+/gi, 'x-api-key: [REDACTED_HEADER]');
    result = result.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');
    return result;
  }

  public static scrubObject<T>(obj: T): T {
    if (!obj) return obj;
    const json = JSON.stringify(obj);
    const scrubbedJson = this.scrubText(json);
    return JSON.parse(scrubbedJson);
  }
}
