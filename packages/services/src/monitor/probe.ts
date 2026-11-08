import { type Region, regionDict } from "@openstatus/regions";

const FLY_CHECKER_URL = "https://openstatus-checker.fly.dev/ping";
const KOYEB_CHECKER_URL = "https://openstatus-checker.koyeb.app/ping";
const RAILWAY_CHECKER_URL =
  "https://railway-proxy-production-9cb1.up.railway.app/ping";

export const REGION_TIMEOUT_MS = 10_000;

export type CheckResultSuccess = {
  state: "success";
  type: "http";
  region: Region;
  status: number;
  latency: number;
  timestamp: number;
  timing: {
    dnsStart: number;
    dnsDone: number;
    connectStart: number;
    connectDone: number;
    tlsHandshakeStart: number;
    tlsHandshakeDone: number;
    firstByteStart: number;
    firstByteDone: number;
    transferStart: number;
    transferDone: number;
  };
  headers?: Record<string, string>;
  body?: string | null;
};

export type CheckResultError = {
  state: "error";
  type: "http";
  region: Region;
  message: string;
  timestamp: number;
};

export type CheckResult = CheckResultSuccess | CheckResultError;

function getCheckerEndpoint(region: Region): {
  endpoint: string;
  regionHeader: Record<string, string>;
} {
  const provider = regionDict[region]?.provider ?? "fly";
  switch (provider) {
    case "fly":
      return {
        endpoint: `${FLY_CHECKER_URL}/${region}`,
        regionHeader: { "fly-prefer-region": region },
      };
    case "koyeb":
      return {
        endpoint: `${KOYEB_CHECKER_URL}/${region}`,
        regionHeader: {
          "X-KOYEB-REGION-OVERRIDE": region.replace("koyeb_", ""),
        },
      };
    case "railway":
      return {
        endpoint: `${RAILWAY_CHECKER_URL}/${region}`,
        regionHeader: { "railway-region": region.replace("railway_", "") },
      };
    default:
      return {
        endpoint: `${FLY_CHECKER_URL}/${region}`,
        regionHeader: {},
      };
  }
}

/** Stored `[{key,value}]` JSON → header map; `undefined` when absent or malformed. */
export function parseStoredHeaders(
  stored: string | null | undefined,
): Record<string, string> | undefined {
  if (!stored) return undefined;
  try {
    const parsed = JSON.parse(stored) as Array<{ key: string; value: string }>;
    return parsed.reduce<Record<string, string>>((acc, h) => {
      if (h.key) acc[h.key] = h.value;
      return acc;
    }, {});
  } catch {
    return undefined;
  }
}

/** One ephemeral HTTP probe through the checker in `region`; never persisted. */
export async function probeRegion(args: {
  region: Region;
  url: string;
  method: string;
  headers: Record<string, string> | undefined;
  body: string | undefined;
  cronSecret: string | undefined;
}): Promise<CheckResult> {
  const { region, url, method, headers, body, cronSecret } = args;
  const { endpoint, regionHeader } = getCheckerEndpoint(region);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...(cronSecret ? { Authorization: `Basic ${cronSecret}` } : {}),
        "Content-Type": "application/json",
        ...regionHeader,
      },
      body: JSON.stringify({
        url,
        method,
        headers,
        body,
      }),
      signal: AbortSignal.timeout(REGION_TIMEOUT_MS),
    });

    const json = (await res.json()) as Record<string, unknown>;

    // The checker reports an unreachable target as 200 with a message and
    // no status, so anything without a numeric status is a failed check.
    if (
      !json ||
      typeof json !== "object" ||
      json.state === "error" ||
      typeof json.status !== "number"
    ) {
      const message = [json?.message, json?.error].find(
        (v) => typeof v === "string",
      ) as string | undefined;
      return {
        state: "error",
        type: "http",
        region,
        message: message ?? "Failed",
        timestamp: Date.now(),
      };
    }
    return {
      state: "success",
      type: "http",
      region,
      status: typeof json.status === "number" ? json.status : 0,
      latency: typeof json.latency === "number" ? json.latency : 0,
      timestamp:
        typeof json.timestamp === "number" ? json.timestamp : Date.now(),
      timing: (json.timing as CheckResultSuccess["timing"]) ?? {
        dnsStart: 0,
        dnsDone: 0,
        connectStart: 0,
        connectDone: 0,
        tlsHandshakeStart: 0,
        tlsHandshakeDone: 0,
        firstByteStart: 0,
        firstByteDone: 0,
        transferStart: 0,
        transferDone: 0,
      },
      headers: (json.headers as Record<string, string>) ?? undefined,
      body: typeof json.body === "string" ? json.body : null,
    };
  } catch (err) {
    return {
      state: "error",
      type: "http",
      region,
      message: err instanceof Error ? err.message : "Network error",
      timestamp: Date.now(),
    };
  }
}
