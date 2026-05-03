import type { OnboardingChecksRow } from "@/components/onboarding/checks-table";

const SAMPLE: Array<{ region: string; status: number; latency: number }> = [
  { region: "ams", status: 200, latency: 44 },
  { region: "fra", status: 200, latency: 84 },
  { region: "arn", status: 200, latency: 167 },
  { region: "iad", status: 200, latency: 44 },
  { region: "sin", status: 200, latency: 32 },
  { region: "ewr", status: 200, latency: 133 },
  { region: "cdg", status: 200, latency: 219 },
  { region: "ord", status: 200, latency: 118 },
  { region: "sjc", status: 200, latency: 119 },
  { region: "yyz", status: 200, latency: 104 },
  { region: "lhr", status: 200, latency: 297 },
  { region: "dfw", status: 200, latency: 132 },
  { region: "lax", status: 200, latency: 128 },
  { region: "nrt", status: 200, latency: 211 },
  { region: "hkg", status: 200, latency: 198 },
  { region: "syd", status: 200, latency: 254 },
  { region: "bom", status: 200, latency: 276 },
  { region: "gru", status: 200, latency: 187 },
  { region: "scl", status: 200, latency: 232 },
  { region: "jnb", status: 200, latency: 312 },
  { region: "mad", status: 200, latency: 92 },
  { region: "waw", status: 200, latency: 138 },
  { region: "otp", status: 200, latency: 156 },
  { region: "mia", status: 200, latency: 96 },
  { region: "atl", status: 200, latency: 88 },
  { region: "sea", status: 200, latency: 142 },
  { region: "phx", status: 200, latency: 124 },
  { region: "den", status: 200, latency: 113 },
  { region: "yul", status: 200, latency: 98 },
  { region: "gdl", status: 200, latency: 165 },
  { region: "bog", status: 200, latency: 178 },
  { region: "eze", status: 200, latency: 245 },
];

// Fixed seed timestamp keeps SSR/CSR HTML identical (no hydration mismatch).
// Exact value is irrelevant — the placeholder sits behind a hint overlay.
const now = new Date("2026-01-01T00:00:00.000Z").getTime();

// Deterministic pseudo-random in [0, 1) seeded by string — keeps SSR/CSR stable.
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function jitter(seed: string, base: number, spread: number) {
  return base + (seeded(seed) - 0.5) * 2 * spread;
}

function buildTiming(region: string, latency: number) {
  const weights = {
    dns: jitter(`${region}:dns`, 0.08, 0.04),
    connect: jitter(`${region}:connect`, 0.14, 0.06),
    tls: jitter(`${region}:tls`, 0.22, 0.08),
    ttfb: jitter(`${region}:ttfb`, 0.45, 0.1),
    transfer: jitter(`${region}:transfer`, 0.11, 0.05),
  };
  const total =
    weights.dns +
    weights.connect +
    weights.tls +
    weights.ttfb +
    weights.transfer;
  const dns = Math.max(1, Math.round((weights.dns / total) * latency));
  const connect = Math.max(1, Math.round((weights.connect / total) * latency));
  const tls = Math.max(1, Math.round((weights.tls / total) * latency));
  const transfer = Math.max(
    1,
    Math.round((weights.transfer / total) * latency),
  );
  const ttfb = Math.max(1, latency - dns - connect - tls - transfer);
  return { dns, connect, tls, ttfb, transfer };
}

export const exampleChecks: OnboardingChecksRow[] = SAMPLE.map(
  ({ region, status, latency }, i) =>
    ({
      type: "http",
      id: region,
      latency,
      statusCode: status,
      requestStatus: "success",
      region,
      timing: buildTiming(region, latency),
      timestamp: now + i * 1000,
      cronTimestamp: now + i * 1000,
      trigger: "api",
      monitorId: "0",
      url: "",
      error: false,
      message: null,
      headers: null,
      body: null,
      assertions: null,
      workspaceId: "",
    }) satisfies OnboardingChecksRow,
);
