import type { SampleConversation } from "../types";

export const debugMemoryLeak: SampleConversation = {
  id: "debug-memory-leak",
  title: "Hunt a Memory Leak",
  description: "Tracking down and fixing a Node.js memory leak in a production service",
  category: "agentic",
  messages: [
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "Our Node.js API server's memory usage keeps climbing in production. It starts at 200MB and hits 1.5GB after about 6 hours, then the container gets OOM-killed. Can you help investigate?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content:
            "Classic memory leak pattern — steady climb over hours. Let me start by looking at the server setup and any common leak sources.",
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/server.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { metricsRouter } from './routes/metrics';
import { apiRouter } from './routes/api';
import { EventTracker } from './services/event-tracker';
import { CacheManager } from './services/cache-manager';
import { logger } from './lib/logger';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Global instances
const eventTracker = new EventTracker();
const cache = new CacheManager({ ttl: 300_000 }); // 5 min TTL

app.use(express.json());
app.use('/metrics', metricsRouter);
app.use('/api', apiRouter(eventTracker, cache));

// WebSocket connections for live dashboards
wss.on('connection', (ws) => {
  logger.info('Dashboard client connected');

  const interval = setInterval(() => {
    ws.send(JSON.stringify(eventTracker.getSnapshot()));
  }, 1000);

  ws.on('close', () => {
    logger.info('Dashboard client disconnected');
    clearInterval(interval);
  });
});

server.listen(3000, () => {
  logger.info('Server listening on port 3000');
});`,
        },
        {
          type: "text",
          content:
            "I see a WebSocket setup and two services — EventTracker and CacheManager. Both are common leak sources. Let me examine each.",
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/services/event-tracker.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import { EventEmitter } from 'events';

interface TrackedEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  userId?: string;
}

export class EventTracker extends EventEmitter {
  private events: TrackedEvent[] = [];
  private listeners: Map<string, Set<(event: TrackedEvent) => void>> = new Map();

  track(event: TrackedEvent) {
    this.events.push(event);
    this.emit('event', event);

    // Notify registered listeners for this event type
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((fn) => fn(event));
    }
  }

  subscribe(type: string, callback: (event: TrackedEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  getSnapshot() {
    return {
      totalEvents: this.events.length,
      last100: this.events.slice(-100),
      byType: this.getCountsByType(),
    };
  }

  private getCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    return counts;
  }
}`,
        },
        {
          type: "text",
          content: `Found the primary leak. The \`EventTracker\` has a critical problem:

**\`this.events\` grows without bound.** Every tracked event is pushed to the array and never removed. Over 6 hours with a busy API, this could easily accumulate hundreds of thousands of events, each containing arbitrary \`data\` objects.

The \`getCountsByType()\` method iterates the *entire* array every time it's called (once per second per WebSocket client via \`getSnapshot()\`), which also gets slower and slower over time.

There's also a secondary concern: the \`subscribe\` method has no corresponding \`unsubscribe\`, so listeners could leak. Let me check the cache manager too.`,
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify(
            { path: "src/services/cache-manager.ts" },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheOptions {
  ttl: number; // milliseconds
}

export class CacheManager {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private ttl: number;

  constructor(options: CacheOptions) {
    this.ttl = options.ttl;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      // Expired, but don't delete — just return undefined
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}`,
        },
        {
          type: "text",
          content: `Second leak confirmed. The \`CacheManager\` has a subtle but important bug:

When an entry expires, \`get()\` returns \`undefined\` but **does not delete the entry** from the Map. Expired entries accumulate forever. Over time, the Map grows with stale entries that are never cleaned up.

There's also no cleanup interval — entries just pile up even if they're never accessed again.

Let me also check how the API routes use the event tracker to see if there's a listener leak.`,
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/routes/api.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import { Router, Request, Response } from 'express';
import { EventTracker } from '../services/event-tracker';
import { CacheManager } from '../services/cache-manager';

export function apiRouter(tracker: EventTracker, cache: CacheManager) {
  const router = Router();

  router.post('/events', (req: Request, res: Response) => {
    const { type, data, userId } = req.body;
    tracker.track({
      type,
      timestamp: Date.now(),
      data,
      userId,
    });
    res.status(202).json({ status: 'accepted' });
  });

  router.get('/events/stream/:type', (req: Request, res: Response) => {
    const { type } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    const callback = (event: any) => {
      res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);
    };

    tracker.subscribe(type, callback);

    req.on('close', () => {
      // BUG: no unsubscribe!
    });
  });

  router.get('/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const cacheKey = \`user:\${id}\`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Simulate DB lookup
    const user = { id, name: 'Test User', email: 'test@example.com' };
    cache.set(cacheKey, user);
    res.json(user);
  });

  return router;
}`,
        },
        {
          type: "text",
          content: `Third leak confirmed in the SSE endpoint (\`/events/stream/:type\`). When a client disconnects, the \`close\` handler doesn't unsubscribe the callback from the EventTracker. So every SSE connection that closes leaves a dead callback in the \`listeners\` Map, and those callbacks hold references to the closed \`res\` object.

Here's the full picture of the three leaks:

1. **EventTracker.events** — unbounded array, never pruned
2. **CacheManager.store** — expired entries never deleted
3. **SSE listener leak** — callbacks not cleaned up on disconnect

Let me fix all three.`,
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/services/event-tracker.ts",
              old_string: `export class EventTracker extends EventEmitter {
  private events: TrackedEvent[] = [];
  private listeners: Map<string, Set<(event: TrackedEvent) => void>> = new Map();

  track(event: TrackedEvent) {
    this.events.push(event);
    this.emit('event', event);

    // Notify registered listeners for this event type
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((fn) => fn(event));
    }
  }

  subscribe(type: string, callback: (event: TrackedEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  getSnapshot() {
    return {
      totalEvents: this.events.length,
      last100: this.events.slice(-100),
      byType: this.getCountsByType(),
    };
  }

  private getCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    return counts;
  }
}`,
              new_string: `export class EventTracker extends EventEmitter {
  private events: TrackedEvent[] = [];
  private eventCounts: Record<string, number> = {};
  private totalEventCount = 0;
  private readonly maxEvents: number;
  private listeners: Map<string, Set<(event: TrackedEvent) => void>> = new Map();

  constructor(maxEvents = 10_000) {
    super();
    this.maxEvents = maxEvents;
  }

  track(event: TrackedEvent) {
    this.events.push(event);
    this.totalEventCount++;
    this.eventCounts[event.type] = (this.eventCounts[event.type] || 0) + 1;

    // Prune old events to prevent unbounded growth
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.emit('event', event);

    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((fn) => fn(event));
    }
  }

  subscribe(type: string, callback: (event: TrackedEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  unsubscribe(type: string, callback: (event: TrackedEvent) => void) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(callback);
      if (typeListeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  getSnapshot() {
    return {
      totalEvents: this.totalEventCount,
      last100: this.events.slice(-100),
      byType: { ...this.eventCounts },
    };
  }
}`,
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully edited src/services/event-tracker.ts",
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/services/cache-manager.ts",
              old_string: `  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      // Expired, but don't delete — just return undefined
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}`,
              new_string: `  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options: CacheOptions) {
    this.ttl = options.ttl;

    // Periodically sweep expired entries
    this.cleanupInterval = setInterval(() => this.sweep(), this.ttl);
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);  // Clean up expired entry immediately
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}`,
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully edited src/services/cache-manager.ts",
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/routes/api.ts",
              old_string: `    tracker.subscribe(type, callback);

    req.on('close', () => {
      // BUG: no unsubscribe!
    });`,
              new_string: `    tracker.subscribe(type, callback);

    req.on('close', () => {
      tracker.unsubscribe(type, callback);
    });`,
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully edited src/routes/api.ts",
        },
        {
          type: "text",
          content: `All three leaks are fixed. Here's a summary:

**Leak 1: EventTracker.events (unbounded array)**
- Added a \`maxEvents\` cap (default 10,000). When exceeded, old events are pruned via \`slice\`.
- Moved event counting to an incremental \`eventCounts\` object instead of recounting the entire array on every \`getSnapshot()\` call. This also fixes the O(n) performance degradation.

**Leak 2: CacheManager (expired entries never removed)**
- \`get()\` now calls \`this.store.delete(key)\` when it finds an expired entry (lazy cleanup).
- Added a periodic \`sweep()\` that runs every TTL interval and removes all expired entries (proactive cleanup for entries that are never accessed again).
- Added a \`destroy()\` method to clean up the interval.

**Leak 3: SSE listener leak (callbacks not cleaned up on disconnect)**
- Added \`unsubscribe()\` method to EventTracker that removes the callback from the Set.
- SSE \`close\` handler now calls \`tracker.unsubscribe(type, callback)\`.
- Also cleans up empty Sets from the listeners Map to prevent Map key accumulation.

With these fixes, memory usage should stabilize. The EventTracker will hold at most 10,000 events (configurable), the cache will self-clean, and SSE connections will properly clean up after themselves.`,
        },
      ],
    },
  ],
};
