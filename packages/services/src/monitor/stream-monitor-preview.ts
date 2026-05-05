import { ALL_REGIONS, type Region, regionDict } from "@openstatus/regions";
import { yieldMany } from "@openstatus/utils";
import { z } from "zod";

import { type ServiceContext, getReadDb } from "../context";
import { InternalServiceError } from "../errors";
import { getMonitorInWorkspace } from "./internal";

export const StreamMonitorPreviewInput = z.object({
  monitorId: z.number(),
});

export type StreamMonitorPreviewInput = z.infer<
  typeof StreamMonitorPreviewInput
>;

const FLY_CHECKER_URL = "https://openstatus-checker.fly.dev/ping";
const KOYEB_CHECKER_URL = "https://openstatus-checker.koyeb.app/ping";
const RAILWAY_CHECKER_URL =
  "https://railway-proxy-production-9cb1.up.railway.app/ping";

const REGION_TIMEOUT_MS = 10_000;

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

async function probeRegion(args: {
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

    if (json && typeof json === "object" && json.state === "error") {
      return {
        state: "error",
        type: "http",
        region,
        message: typeof json.message === "string" ? json.message : "Failed",
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

/**
 * Streaming async generator — yields per-region preview results as they arrive.
 * Probes ALL 28 regions, regardless of `monitor.regions` (plan-bounded).
 * Does NOT persist to Tinybird. Ephemeral, onboarding-only.
 */
export async function* streamMonitorPreview(args: {
  ctx: ServiceContext;
  input: StreamMonitorPreviewInput;
}): AsyncGenerator<CheckResult> {
  const { ctx } = args;
  const input = StreamMonitorPreviewInput.parse(args.input);

  const tx = getReadDb(ctx);
  const monitor = await getMonitorInWorkspace({
    tx,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });

  const headers = monitor.headers
    ? (() => {
        try {
          const parsed = JSON.parse(monitor.headers as string) as Array<{
            key: string;
            value: string;
          }>;
          return parsed.reduce<Record<string, string>>((acc, h) => {
            if (h.key) acc[h.key] = h.value;
            return acc;
          }, {});
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new InternalServiceError("CRON_SECRET is not set");
  }

  // Skip deprecated regions — fly (and other providers) no longer run
  // machines there, so probes time out and produce noise rows. Mirrors
  // the existing `pickDefaultRegions` filter in `internal.ts`.
  const activeRegions = ALL_REGIONS.filter(
    (region) => !regionDict[region].deprecated,
  );

  const promises: Promise<CheckResult>[] = activeRegions.map((region) =>
    probeRegion({
      region: region as Region,
      url: monitor.url,
      method: monitor.method ?? "GET",
      headers,
      body: monitor.body ?? undefined,
      cronSecret,
    }),
  );

  yield* yieldMany(promises);
}
