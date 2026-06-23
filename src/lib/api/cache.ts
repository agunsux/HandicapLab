import * as fs from 'fs';
import * as path from 'path';

export class ApiCache {
  private cacheDir: string;

  constructor() {
    const isServerless = !!(process.env.VERCEL || process.env.LAMBDA_TASK_ROOT);
    this.cacheDir = isServerless
      ? path.join('/tmp', 'cache', 'api-football')
      : path.join(process.cwd(), 'cache', 'api-football');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getCacheFilePath(endpoint: string, params: Record<string, any>): string {
    const endpointSanitized = endpoint.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(k => `${k}_${String(params[k])}`).join('_');
    const sanitizedParams = paramString.replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    const finalPart = sanitizedParams ? `_${sanitizedParams}` : '';
    let filename = `${endpointSanitized}${finalPart}.json`;
    
    // Hash if path is too long for Windows OS filesystem limits
    if (filename.length > 200) {
      const hash = this.simpleHash(paramString);
      filename = `${endpointSanitized}_hash_${hash}.json`;
    }
    
    return path.join(this.cacheDir, filename);
  }

  /**
   * Check if response is cached and return it.
   */
  public get<T>(endpoint: string, params: Record<string, any>): T | null {
    const filePath = this.getCacheFilePath(endpoint, params);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      console.log(`[ApiCache] Cache hit for endpoint: ${endpoint} with params:`, params);
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (e) {
      console.warn(`[ApiCache] Failed to read/parse cache file ${filePath}:`, e);
      return null;
    }
  }

  /**
   * Store API response in cache file.
   */
  public set(endpoint: string, params: Record<string, any>, data: any): void {
    this.ensureDirectoryExists();
    const filePath = this.getCacheFilePath(endpoint, params);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[ApiCache] Cache stored for endpoint: ${endpoint} with params:`, params);
    } catch (e) {
      console.error(`[ApiCache] Failed to write cache file ${filePath}:`, e);
    }
  }
}

export const apiCache = new ApiCache();
