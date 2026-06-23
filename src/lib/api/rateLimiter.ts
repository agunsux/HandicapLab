import * as fs from 'fs';
import * as path from 'path';

export class RateLimiter {
  private limitFile: string;
  private maxRequestsPerDay = 100;
  private requestDelayMs = 1500; // 1.5 seconds delay between requests

  constructor() {
    this.limitFile = path.join(process.cwd(), 'cache', 'api-football', 'rate-limit.json');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    const dir = path.dirname(this.limitFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getTodayDateString(): string {
    const today = new Date();
    // format as YYYY-MM-DD
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadRateLimitData(): { date: string; count: number } {
    if (!fs.existsSync(this.limitFile)) {
      return { date: this.getTodayDateString(), count: 0 };
    }

    try {
      const content = fs.readFileSync(this.limitFile, 'utf-8');
      const data = JSON.parse(content);
      return {
        date: data.date || this.getTodayDateString(),
        count: typeof data.count === 'number' ? data.count : 0,
      };
    } catch (e) {
      console.warn('Failed to parse rate-limit file, resetting count:', e);
      return { date: this.getTodayDateString(), count: 0 };
    }
  }

  private saveRateLimitData(data: { date: string; count: number }) {
    this.ensureDirectoryExists();
    fs.writeFileSync(this.limitFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Check if we can make a request, increment count, and apply delay.
   * Throws an error if daily limit is reached.
   */
  public async registerRequest(): Promise<void> {
    const today = this.getTodayDateString();
    const data = this.loadRateLimitData();

    if (data.date !== today) {
      data.date = today;
      data.count = 0;
    }

    if (data.count >= this.maxRequestsPerDay) {
      const msg = `API-Football Rate Limit Reached: ${data.count}/${this.maxRequestsPerDay} requests made on ${today}.`;
      console.error(msg);
      throw new Error(msg);
    }

    // Log request
    data.count++;
    this.saveRateLimitData(data);
    console.log(`[RateLimiter] Request registered. Count today (${today}): ${data.count}/${this.maxRequestsPerDay}`);

    // Wait to respect rate limiting (1.5 seconds)
    console.log(`[RateLimiter] Waiting ${this.requestDelayMs}ms before making request...`);
    await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
  }

  /**
   * Returns current request count for today.
   */
  public getTodayRequestCount(): number {
    const today = this.getTodayDateString();
    const data = this.loadRateLimitData();
    if (data.date !== today) {
      return 0;
    }
    return data.count;
  }
}

export const rateLimiter = new RateLimiter();
