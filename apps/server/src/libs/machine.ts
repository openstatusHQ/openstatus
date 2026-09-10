import { env } from "@/env";

/**
 * Machine vitals for `/health`.
 *
 * Everything here is read from this process and the host it runs on. It says
 * nothing about whether Turso or Tinybird are reachable — that is what the
 * probes in `libs/health.ts` are for. `pressure` reports what is wrong with
 * *this* machine, so a report can distinguish "the dependency is down" from
 * "this machine is out of memory".
 */

/** Resolved once: Fly injects these at boot and they never change. */
const identity = {
  id: env.FLY_MACHINE_ID ?? null,
  app: env.FLY_APP_NAME ?? null,
  version: env.FLY_MACHINE_VERSION ?? null,
  region: env.FLY_REGION ?? null,
  environment: env.NODE_ENV,
  runtime: `deno/${Deno.version.deno}`,
};

const bootedAt = Date.now();

/** Above these, the machine reports pressure; the caller decides what that means. */
const MEMORY_DEGRADED_PERCENT = 90;
const SATURATION_DEGRADED_PERCENT = 80;

/** Sampled at most once a second so a polled endpoint never hammers /proc. */
const SAMPLE_TTL_MS = 1_000;

/** `loadavg`, `systemMemoryInfo` and `hostname` need `--allow-sys` and are not implemented on every target. */
function readSys<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

const hostname = readSys(() => Deno.hostname());

type HostSample = {
  process: Deno.MemoryUsage;
  system: Deno.SystemMemoryInfo | null;
  loadAverage: number[] | null;
};

let cached: { at: number; sample: HostSample } | null = null;

function sampleHost(now: number): HostSample {
  if (cached && now - cached.at < SAMPLE_TTL_MS) return cached.sample;
  const sample: HostSample = {
    process: Deno.memoryUsage(),
    system: readSys(() => Deno.systemMemoryInfo()),
    loadAverage: readSys(() => Deno.loadavg()),
  };
  cached = { at: now, sample };
  return sample;
}

function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export type MachineVitals = {
  /** Empty when the machine is healthy; one human-readable reason per breached threshold. */
  pressure: string[];
  machine: typeof identity & { host: string | null; uptimeSeconds: number };
  cpu: {
    cores: number;
    /** 1/5/15 minute load, `null` where the OS does not expose it. */
    loadAverage: number[] | null;
    loadPerCore: number | null;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    totalBytes: number | null;
    availableBytes: number | null;
    usedPercent: number | null;
  };
  requests: {
    inFlight: number;
    maxInFlight: number;
    saturationPercent: number | null;
  };
};

export type MachineVitalsOptions = {
  inFlight: number;
  maxInFlight: number;
};

export function machineVitals(options: MachineVitalsOptions): MachineVitals {
  const now = Date.now();
  const { process, system, loadAverage } = sampleHost(now);
  const cores = navigator.hardwareConcurrency;

  const usedPercent = system
    ? percent(system.total - system.available, system.total)
    : null;
  const saturationPercent = percent(options.inFlight, options.maxInFlight);

  const pressure: string[] = [];
  if (usedPercent !== null && usedPercent >= MEMORY_DEGRADED_PERCENT) {
    pressure.push(`memory at ${usedPercent}% of the machine`);
  }
  if (
    saturationPercent !== null &&
    saturationPercent >= SATURATION_DEGRADED_PERCENT
  ) {
    pressure.push(
      `${options.inFlight} of ${options.maxInFlight} in-flight slots taken`,
    );
  }
  // Load average is reported but never counts as pressure: Fly's shared CPUs
  // make it spike on neighbours we do not control, and no action follows.

  return {
    pressure,
    machine: {
      ...identity,
      host: hostname,
      uptimeSeconds: Math.round((now - bootedAt) / 1000),
    },
    cpu: {
      cores,
      loadAverage,
      loadPerCore:
        loadAverage && cores
          ? Math.round((loadAverage[0] / cores) * 100) / 100
          : null,
    },
    memory: {
      rssBytes: process.rss,
      heapUsedBytes: process.heapUsed,
      heapTotalBytes: process.heapTotal,
      totalBytes: system?.total ?? null,
      availableBytes: system?.available ?? null,
      usedPercent,
    },
    requests: {
      inFlight: options.inFlight,
      maxInFlight: options.maxInFlight,
      saturationPercent,
    },
  };
}
