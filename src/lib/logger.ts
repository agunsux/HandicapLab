// Structured Logger — Single Logging Abstraction
// Location: src/lib/logger.ts
// Usage: import { logger } from '@/lib/logger';
//        logger.info('module', 'message', { key: 'value' });

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  timestamp: string;
  severity: LogSeverity;
  module: string;
  message: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  stack?: string;
}


export interface IChildLogger {
  debug(message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  info(message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  warn(message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  error(message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  fatal(message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  child(module: string): IChildLogger;
}

export interface IParentLogger {
  debug(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  info(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  warn(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  error(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  fatal(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string): void;
  child(module: string): IChildLogger;
}



let requestIdCounter = 0;

export function generateRequestId(): string {
  return `req_${Date.now()}_${(++requestIdCounter).toString(36)}`;
}

function createEntry(
  severity: LogSeverity,
  module: string,
  message: string,
  metadata?: Record<string, any>,
  requestId?: string,
  correlationId?: string
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    severity,
    module,
    message,
    requestId,
    correlationId,
    metadata,
    ...(severity === 'ERROR' || severity === 'FATAL' ? { stack: new Error().stack?.split('\n').slice(2, 5).join('\n') } : {}),
  };
}

function formatConsole(entry: LogEntry): string {
  const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
  const req = entry.requestId ? ` [${entry.requestId}]` : '';
  return `[${entry.timestamp}] ${entry.severity} ${entry.module}${req}: ${entry.message}${meta}`;
}

export const logger: IParentLogger = {

  debug(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string) {

    const entry = createEntry('DEBUG', module, message, meta, reqId, corrId);
    console.debug(formatConsole(entry));
  },
  info(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string) {
    const entry = createEntry('INFO', module, message, meta, reqId, corrId);
    console.info(formatConsole(entry));
  },
  warn(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string) {
    const entry = createEntry('WARN', module, message, meta, reqId, corrId);
    console.warn(formatConsole(entry));
  },
  error(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string) {
    const entry = createEntry('ERROR', module, message, meta, reqId, corrId);
    console.error(formatConsole(entry));
  },
  fatal(module: string, message: string, meta?: Record<string, any>, reqId?: string, corrId?: string) {
    const entry = createEntry('FATAL', module, message, meta, reqId, corrId);
    console.error(formatConsole(entry));
  },
  child(module: string): IChildLogger {
    return {
      debug: (msg: string, meta?: any, reqId?: string, corrId?: string) => this.debug(module, msg, meta, reqId, corrId),
      info: (msg: string, meta?: any, reqId?: string, corrId?: string) => this.info(module, msg, meta, reqId, corrId),
      warn: (msg: string, meta?: any, reqId?: string, corrId?: string) => this.warn(module, msg, meta, reqId, corrId),
      error: (msg: string, meta?: any, reqId?: string, corrId?: string) => this.error(module, msg, meta, reqId, corrId),
      fatal: (msg: string, meta?: any, reqId?: string, corrId?: string) => this.fatal(module, msg, meta, reqId, corrId),
      child: (_childModule: string) => this.child(`${module}:${_childModule}`),
    } as IChildLogger;
  },
};


