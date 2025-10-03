import { vi } from 'vitest';

// Mock global fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn();
}

// Mock global Headers if not available
if (!(global as any).Headers) {
  (global as any).Headers = class Headers {
    constructor(init?: HeadersInit) {
      // Mock implementation
    }
  } as any;
}

// Mock global Request if not available
if (!(global as any).Request) {
  (global as any).Request = Request;
}

// Mock global Response if not available
if (!(global as any).Response) {
  (global as any).Response = Response;
}

// Mock global URL if not available
if (!(global as any).URL) {
  (global as any).URL = URL;
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock ExecutionContext
(global as any).ExecutionContext = class ExecutionContext {
  waitUntil(promise: Promise<any>): void {
    // Mock implementation
  }
  passThroughOnException(): void {
    // Mock implementation
  }
} as any;

// Mock D1Database
(global as any).D1Database = class D1Database {
  prepare(query: string): any {
    return {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] })
    };
  }
  batch(statements: any[]): Promise<any> {
    return Promise.resolve({ results: [] });
  }
  exec(query: string): Promise<any> {
    return Promise.resolve({ success: true });
  }
} as any;

// Mock R2Bucket
(global as any).R2Bucket = class R2Bucket {
  get(key: string): Promise<any> {
    return Promise.resolve(null);
  }
  put(key: string, value: any): Promise<any> {
    return Promise.resolve({ key });
  }
  delete(key: string): Promise<void> {
    return Promise.resolve();
  }
  list(options?: any): Promise<any> {
    return Promise.resolve({ objects: [] });
  }
} as any;

// Mock Queue
(global as any).Queue = class Queue {
  send(body: any): Promise<void> {
    return Promise.resolve();
  }
  sendBatch(messages: any[]): Promise<void> {
    return Promise.resolve();
  }
} as any;

// Mock ScheduledEvent
(global as any).ScheduledEvent = class ScheduledEvent {
  type = 'scheduled';
  scheduledTime = Date.now();
  cron = '*/15 * * * *';
  noRetry = vi.fn();
} as any;

// Mock MessageBatch
(global as any).MessageBatch = class MessageBatch {
  messages: any[] = [];
  ackAll = vi.fn();
  retryAll = vi.fn();
} as any;

// Mock self global for Cloudflare Workers
(global as any).self = {
  fetch: vi.fn()
} as any;
