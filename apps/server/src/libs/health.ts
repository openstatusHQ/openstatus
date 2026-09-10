/**
 * Dependency probes behind `GET /health`.
 *
 * A probe answers one question: can this machine still reach the thing it
 * needs? It resolves when healthy and throws otherwise. Probes run
 * concurrently, each under its own deadline, so one slow dependency cannot
 * hold the whole report — an unreachable service is exactly the case where a
 * call hangs until the socket times out.
 */

export type ProbeStatus = "ok" | "down" | "skipped";

export type Probe = {
  name: string;
  /** A critical dependency that is down makes `/health` answer 503. */
  critical: boolean;
  /** Deadline for this probe alone. */
  timeoutMs: number;
  /** Opt out at runtime — e.g. Tinybird in noop mode, which talks to nothing. */
  skip?: () => boolean;
  /** `signal` aborts at the deadline; probes that cannot take one are raced instead. */
  run: (signal: AbortSignal) => Promise<unknown>;
};

export type ProbeResult = {
  name: string;
  critical: boolean;
  status: ProbeStatus;
  latencyMs: number;
  /** Only on `down`, truncated: probe errors carry connection strings. */
  error?: string;
};

export type HealthReport = {
  status: "ok" | "degraded" | "unhealthy";
  checkedAt: string;
  latencyMs: number;
  checks: ProbeResult[];
};

/** Long enough to name the failure, short enough not to paste a credential into a public response. */
const MAX_ERROR_LENGTH = 200;

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const collapsed = message.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_ERROR_LENGTH
    ? `${collapsed.slice(0, MAX_ERROR_LENGTH)}…`
    : collapsed;
}

async function runProbe(probe: Probe): Promise<ProbeResult> {
  const base = { name: probe.name, critical: probe.critical };
  if (probe.skip?.()) {
    return { ...base, status: "skipped", latencyMs: 0 };
  }

  const startedAt = performance.now();
  const controller = new AbortController();

  // `race` is what actually enforces the deadline: the libSQL client takes no
  // signal, so aborting only helps the probes built on fetch. The timer owns
  // the rejection — hanging it off `abort` instead would fire again when the
  // `finally` below aborts a probe that already answered, rejecting a promise
  // nothing is watching any more.
  let expire!: (reason: Error) => void;
  const expired = new Promise<never>((_, reject) => {
    expire = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    expire(new Error(`timed out after ${probe.timeoutMs}ms`));
  }, probe.timeoutMs);

  try {
    await Promise.race([probe.run(controller.signal), expired]);
    return {
      ...base,
      status: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      ...base,
      status: "down",
      latencyMs: Math.round(performance.now() - startedAt),
      error: describe(error),
    };
  } finally {
    clearTimeout(timer);
    // Release a probe still waiting on the network once we have our answer.
    controller.abort();
  }
}

export async function runProbes(probes: Probe[]): Promise<HealthReport> {
  const startedAt = performance.now();
  const checks = await Promise.all(probes.map(runProbe));

  const down = checks.filter((check) => check.status === "down");
  const status = down.some((check) => check.critical)
    ? "unhealthy"
    : down.length
      ? "degraded"
      : "ok";

  return {
    status,
    checkedAt: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    checks,
  };
}
