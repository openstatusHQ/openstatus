import { z } from "zod";

import { monitorRegionSchema } from "@openstatus/db/src/schema/constants";
import type { Region } from "@openstatus/db/src/schema/constants";
import { continentDict, getRegionInfo, regionDict } from "@openstatus/regions";
import { Redis } from "@upstash/redis";

// ============================================================================
// Constants
// ============================================================================

const FLY_CHECKER_URL = "https://checker.openstatus.dev/ping";
const KOYEB_CHECKER_URL = "https://openstatus-checker.koyeb.app/ping";
const RAILWAY_CHECKER_URL =
  "https://railway-proxy-production-9cb1.up.railway.app/ping";

// ============================================================================
// Formatters
// ============================================================================

export function latencyFormatter(value: number) {
  return `${new Intl.NumberFormat("us").format(value).toString()}ms`;
}

export function timestampFormatter(timestamp: number) {
  return new Date(timestamp).toUTCString(); // GMT format
}

export function continentFormatter(region: Region) {
  const continent = regionDict[region].continent;
  return continentDict[continent].code;
}

export function regionFormatter(
  region: string,
  type: "short" | "long" = "short",
) {
  const { code, flag, location } = getRegionInfo(region);
  if (type === "short") return `${code} ${flag}`;
  return `${location} ${flag}`;
}

// ============================================================================
// Timing Utilities
// ============================================================================

export function getTotalLatency(timing: Timing) {
  const { dns, connection, tls, ttfb, transfer } = getTimingPhases(timing);
  return dns + connection + tls + ttfb + transfer;
}

export function getTimingPhases(timing: Timing) {
  const dns = timing.dnsDone - timing.dnsStart;
  const connection = timing.connectDone - timing.connectStart;
  const tls = timing.tlsHandshakeDone - timing.tlsHandshakeStart;
  const ttfb = timing.firstByteDone - timing.firstByteStart;
  const transfer = timing.transferDone - timing.transferStart;

  return {
    dns,
    connection,
    tls,
    ttfb,
    transfer,
  };
}

export function getTimingPhasesWidth(timing: Timing) {
  const total = getTotalLatency(timing);
  const phases = getTimingPhases(timing);

  const dns = { preWidth: 0, width: (phases.dns / total) * 100 };

  const connection = {
    preWidth: dns.preWidth + dns.width,
    width: (phases.connection / total) * 100,
  };

  const tls = {
    preWidth: connection.preWidth + connection.width,
    width: (phases.tls / total) * 100,
  };

  const ttfb = {
    preWidth: tls.preWidth + tls.width,
    width: (phases.ttfb / total) * 100,
  };

  const transfer = {
    preWidth: ttfb.preWidth + ttfb.width,
    width: (phases.transfer / total) * 100,
  };

  return {
    dns,
    connection,
    tls,
    ttfb,
    transfer,
  };
}

// ============================================================================
// Schemas & Types
// ============================================================================

export const timingSchema = z.object({
  dnsStart: z.number(),
  dnsDone: z.number(),
  connectStart: z.number(),
  connectDone: z.number(),
  tlsHandshakeStart: z.number(),
  tlsHandshakeDone: z.number(),
  firstByteStart: z.number(),
  firstByteDone: z.number(),
  transferStart: z.number(),
  transferDone: z.number(),
});

export const checkerSchema = z.object({
  type: z.literal("http").prefault("http"),
  state: z.literal("success").prefault("success"),
  status: z.number(),
  latency: z.number(),
  headers: z.record(z.string(), z.string()),
  timestamp: z.number(),
  timing: timingSchema,
  body: z.string().optional().nullable(),
});

export const cachedCheckerSchema = z.object({
  url: z.string(),
  timestamp: z.number(),
  method: z.string(), // Simplified - validation happens at runtime
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  body: z.string().optional(),
  checks: checkerSchema.extend({ region: monitorRegionSchema }).array(),
});

const errorRequest = z.object({
  message: z.string(),
  state: z.literal("error").prefault("error"),
});

export const regionCheckerSchema = checkerSchema.extend({
  region: monitorRegionSchema,
  state: z.literal("success").prefault("success"),
});

export const regionCheckerSchemaResponse = regionCheckerSchema.or(
  errorRequest.extend({
    region: monitorRegionSchema,
  }),
);

export type Timing = z.infer<typeof timingSchema>;
export type Checker = z.infer<typeof checkerSchema>;
export type RegionChecker = z.infer<typeof regionCheckerSchema>;
export type RegionCheckerResponse = z.infer<typeof regionCheckerSchemaResponse>;
export type Method =
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "CONNECT"
  | "TRACE";
export type CachedRegionChecker = z.infer<typeof cachedCheckerSchema>;
export type ErrorRequest = z.infer<typeof errorRequest>;

type CheckRegionRequest = {
  url: string;
  region: Region;
  method?: Method;
  headers?: { value: string; key: string }[];
  body?: string;
};

// ============================================================================
// API Functions
// ============================================================================

export async function checkRegion(
  props: CheckRegionRequest,
): Promise<RegionCheckerResponse> {
  const { url, region, method, headers, body } = props;
  const regionInfo = regionDict[region];

  let endpoint = "";
  let regionHeader = {};
  switch (regionInfo.provider) {
    case "fly":
      endpoint = `${FLY_CHECKER_URL}/${region}`;
      regionHeader = { "fly-prefer-region": region };
      break;
    case "koyeb":
      endpoint = `${KOYEB_CHECKER_URL}/${region}`;
      regionHeader = {
        "X-KOYEB-REGION-OVERRIDE": region.replace("koyeb_", ""),
      };
      break;
    case "railway":
      endpoint = `${RAILWAY_CHECKER_URL}/${region}`;
      regionHeader = { "railway-region": region.replace("railway_", "") };
      break;
    default:
      break;
  }

  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Basic ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
      ...regionHeader,
    },
    method: "POST",
    body: JSON.stringify({
      url,
      method: method || "GET",
      headers: headers?.reduce(
        (acc, { key, value }) => {
          if (!key) return acc; // key === "" is an invalid header
          return { ...acc, [key]: value };
        },
        {} as Record<string, string>,
      ),
      body: body ? body : undefined,
    }),
    next: { revalidate: 0 },
  });

  const json = await res.json();

  const data = checkerSchema.or(errorRequest).safeParse(json);

  if (!data.success) {
    console.error(JSON.stringify(res));
    console.error(JSON.stringify(json));
    console.error(
      `something went wrong with request to ${url} error ${data.error.message}`,
    );
    throw new Error(data.error.message);
  }

  return {
    region,
    ...data.data,
  };
}

// ============================================================================
// Redis Caching
// ============================================================================

export async function storeBaseCheckerData({
  url,
  method,
  id,
}: {
  url: string;
  method: Method;
  id: string;
}) {
  const redis = Redis.fromEnv();
  const timestamp = new Date().getTime();
  const cache = { url, method, timestamp };

  const parsed = cachedCheckerSchema
    .pick({ url: true, method: true, timestamp: true })
    .safeParse(cache);

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  await redis.hset(`check:base:${id}`, parsed.data);
  const expire = 60 * 60 * 24 * 7; // 7days
  await redis.expire(`check:base:${id}`, expire);
}

export async function storeCheckerData({
  check,
  id,
}: {
  check: RegionChecker;
  id: string;
}) {
  const parsed = cachedCheckerSchema
    .pick({ checks: true })
    .safeParse({ checks: [check] });

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const first = parsed.data.checks?.[0];

  const redis = Redis.fromEnv();
  if (first) await redis.sadd(`check:data:${id}`, first);

  return id;
}

export async function getCheckerDataById(id: string) {
  const redis = Redis.fromEnv();
  const pipe = redis.pipeline();
  pipe.hgetall(`check:base:${id}`);
  pipe.smembers(`check:data:${id}`);

  const res =
    await pipe.exec<
      [{ url: string; method: Method; time: number }, RegionChecker]
    >();

  if (!res) {
    return null;
  }

  const parsed = cachedCheckerSchema.safeParse({ ...res[0], checks: res[1] });

  if (!parsed.success) {
    // throw new Error(parsed.error.message);
    return null;
  }

  return parsed.data;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Simple function to validate crypto.randomUUID() format like "aec4e0ec3c4f4557b8ce46e55078fc95"
 * @param uuid
 * @returns
 */
export function is32CharHex(uuid: string) {
  const hexRegex = /^[0-9a-fA-F]{32}$/;
  return hexRegex.test(uuid);
}
