// Props to https://github.com/isaacs/node-lru-cache?tab=readme-ov-file#storage-bounds-safety

export class MemoryCache {
  private ttl: number;
  private data: Map<string, unknown>;
  private timers: Map<string, NodeJS.Timeout>;

  constructor(defaultTTL = 60 * 1000) {
    this.ttl = defaultTTL;
    this.data = new Map();
    this.timers = new Map();
  }

  set<T>(key: string, value: T, ttl = this.ttl) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    this.timers.set(
      key,
      setTimeout(() => this.delete(key), ttl),
    );
    this.data.set(key, value);
    return value;
  }

  get<T>(key: string) {
    return this.data.get(key) as T;
  }

  has(key: string) {
    return this.data.has(key);
  }

  delete(key: string) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    this.timers.delete(key);
    return this.data.delete(key);
  }

  clear() {
    this.data.clear();
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

const cache = new MemoryCache();
