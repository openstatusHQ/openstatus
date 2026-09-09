import { getLogger } from "@logtape/logtape";

import { env } from "../env";
import { drainOnce, releaseClaims } from "./drain";
import { pruneOnce } from "./retention";
import { sweepOnce } from "./sweep";

const logger = getLogger(["ingest"]);

type TimerHandle = ReturnType<typeof setInterval>;

let drainTimer: TimerHandle | null = null;
let sweepTimer: TimerHandle | null = null;
let pruneTimer: TimerHandle | null = null;
let draining = false;
let stopping = false;

/**
 * The durable state is the inbox row; this only decides when to look. Losing it
 * on restart costs nothing.
 */
export function kickDrainer(_inboxId: number): void {
  if (stopping) return;
  void runDrain();
}

async function runDrain(): Promise<void> {
  if (draining || stopping) return;
  draining = true;
  try {
    await drainOnce();
  } catch (error) {
    logger.error("drain failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    draining = false;
  }
}

function every(
  ms: number,
  fn: () => Promise<unknown>,
  label: string,
): TimerHandle {
  return setInterval(() => {
    if (stopping) return;
    void fn().catch((error: unknown) => {
      logger.error(`${label} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, ms);
}

export function startScheduler(): void {
  stopping = false;
  drainTimer = every(env.DRAIN_INTERVAL_MS, runDrain, "drain");
  sweepTimer = every(env.SWEEP_INTERVAL_MS, () => sweepOnce(), "sweep");
  pruneTimer = every(env.RETENTION_INTERVAL_MS, pruneOnce, "prune");
  logger.info("scheduler started", {
    drain_ms: env.DRAIN_INTERVAL_MS,
    sweep_ms: env.SWEEP_INTERVAL_MS,
    prune_ms: env.RETENTION_INTERVAL_MS,
  });
}

export async function stopScheduler(): Promise<void> {
  stopping = true;
  for (const timer of [drainTimer, sweepTimer, pruneTimer]) {
    if (timer !== null) clearInterval(timer);
  }
  drainTimer = null;
  sweepTimer = null;
  pruneTimer = null;
  const released = await releaseClaims();
  logger.info("scheduler stopped", { released });
}
