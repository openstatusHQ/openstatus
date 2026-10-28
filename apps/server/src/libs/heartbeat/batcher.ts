import { getLogger } from "@logtape/logtape";

const logger = getLogger("api-server");

export type BatcherOptions = {
  maxBatchSize: number;
  flushIntervalMs: number;
  /** Total backoff one batch may wait through before it is dropped. */
  retryBudgetMs: number;
  maxBufferSize: number;
};

export const DEFAULT_BATCHER_OPTIONS: BatcherOptions = {
  maxBatchSize: 500,
  flushIntervalMs: 5_000,
  retryBudgetMs: 30_000,
  maxBufferSize: 10_000,
};

type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Buffers events and sends them in NDJSON batches, so a burst of pings is one
 * Tinybird request rather than hundreds. Delivery is best effort: a batch that
 * keeps failing for the retry budget is dropped and logged.
 */
export class Batcher<T> {
  private buffer: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = new Set<Promise<void>>();

  constructor(
    private readonly send: (events: T[]) => Promise<void>,
    private readonly options: BatcherOptions = DEFAULT_BATCHER_OPTIONS,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  add(event: T): void {
    if (this.buffer.length >= this.options.maxBufferSize) {
      logger.warn("heartbeat batcher buffer full, dropping event", {
        buffer_size: this.buffer.length,
      });
      return;
    }
    this.buffer.push(event);
    if (this.buffer.length >= this.options.maxBatchSize) {
      this.flushNow();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flushNow(), this.options.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  /** Sends whatever is buffered and waits for every batch in flight. */
  async flush(): Promise<void> {
    this.flushNow();
    while (this.inFlight.size > 0) {
      await Promise.all(this.inFlight);
    }
  }

  private flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.options.maxBatchSize);
      const task = this.sendWithRetry(batch).finally(() => {
        this.inFlight.delete(task);
      });
      this.inFlight.add(task);
    }
  }

  private async sendWithRetry(batch: T[]): Promise<void> {
    let waited = 0;
    for (let attempt = 0; ; attempt++) {
      try {
        await this.send(batch);
        return;
      } catch (error) {
        const delay = Math.min(250 * 2 ** attempt, 8_000);
        waited += delay;
        if (waited > this.options.retryBudgetMs) {
          logger.error("heartbeat batch dropped after retries", {
            error,
            batch_size: batch.length,
            attempts: attempt + 1,
          });
          return;
        }
        await this.sleep(delay);
      }
    }
  }
}
