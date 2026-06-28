import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  request_id: string;
}

export class ApiHelper {
  /**
   * Normalizes any payload or error into a consistent api response shape.
   */
  public static response<T = any>(
    success: boolean,
    data: T | null = null,
    error: any = null,
    status: number = 200
  ): NextResponse<ApiResponse<T>> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const errMessage = error ? (error.message || String(error)) : null;
    return NextResponse.json(
      {
        success,
        data,
        error: errMessage,
        request_id: requestId
      },
      { status }
    );
  }

  /**
   * Executes a promise, racing it against a timeout limit.
   */
  public static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = 10000
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs)
    );
    return Promise.race([fn(), timeoutPromise]);
  }
}
