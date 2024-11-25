import { Redis } from "@upstash/redis";
import { z } from "zod";

import {
  flyRegions,
  monitorFlyRegionSchema,
} from "@openstatus/db/src/schema/constants";
import type { MonitorFlyRegion } from "@openstatus/db/src/schema/constants";
import { continentDict, flyRegionsDict } from "@openstatus/utils";

export function latencyFormatter(value: number) {
  return `${new Intl.NumberFormat("us").format(value).toString()}ms`;
}

export function timestampFormatter(timestamp: number) {
  return new Date(timestamp).toUTCString(); // GMT format
}

export function continentFormatter(region: MonitorFlyRegion) {
  const continent = flyRegionsDict[region].continent;
  return continentDict[continent].code;
}

export function regionFormatter(
  region: MonitorFlyRegion,
  type: "short" | "long" = "short",
) {
  const { code, flag, location } = flyRegionsDict[region];
  if (type === "short") return `${code} ${flag}`;
  return `${location} ${flag}`;
}

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
  type: z.literal("http").default("http"),
  status: z.number(),
  latency: z.number(),
  headers: z.record(z.string()),
  timestamp: z.number(),
  timing: timingSchema,
  body: z.string().optional().nullable(),
});

export const cachedCheckerSchema = z.object({
  url: z.string(),
  timestamp: z.number(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  checks: checkerSchema.extend({ region: monitorFlyRegionSchema }).array(),
});

export const regionCheckerSchema = checkerSchema.extend({
  region: monitorFlyRegionSchema,
});

export type Timing = z.infer<typeof timingSchema>;
export type Checker = z.infer<typeof checkerSchema>;
// FIXME: does not include TCP!
export type RegionChecker = z.infer<typeof regionCheckerSchema>;
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
export type CachedRegionChecker = z.infer<typeof cachedCheckerSchema>;

export async function checkRegion(
  url: string,
  region: MonitorFlyRegion,
  opts?: {
    method?: Method;
    headers?: { value: string; key: string }[];
    body?: string;
  },
): Promise<RegionChecker> {
  //
  const res = await fetch(`https://checker.openstatus.dev/ping/${region}`, {
    headers: {
      Authorization: `Basic ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
      "fly-prefer-region": region,
    },
    method: "POST",
    body: JSON.stringify({
      url,
      method: opts?.method || "GET",
      headers: opts?.headers?.reduce((acc, { key, value }) => {
        if (!key) return acc; // key === "" is an invalid header

        return {
          // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
          ...acc,
          [key]: value,
        };
      }, {}),
      body: opts?.body ? opts.body : undefined,
    }),
    next: { revalidate: 0 },
  });

  const json = await res.json();

  const data = checkerSchema.safeParse(json);

  if (!data.success) {
    console.log(json);
    console.error(
      `something went wrong with result ${json} request to ${url} error ${data.error.message}`,
    );
    throw new Error(data.error.message);
  }

  return {
    region,
    ...data.data,
  };
}

/**
 * Used for the /play/checker page only
 */
export async function checkAllRegions(url: string, opts?: { method: Method }) {
  // TODO: settleAll
  return await Promise.all(
    flyRegions.map(async (region) => {
      const check = await checkRegion(url, region, opts);
      // REMINDER: dropping the body to avoid storing it within Redis Cache (Err max request size exceeded)
      check.body = undefined;
      return check;
    }),
  );
}

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

  return id;
}

export async function storeCheckerData({
  check,
  id,
}: {
  check: RegionChecker;
  id: string;
}) {
  const redis = Redis.fromEnv();

  const parsed = cachedCheckerSchema
    .pick({ checks: true })
    .safeParse({ checks: [check] });

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const first = parsed.data.checks?.[0];

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

/**
 * Simple function to validate crypto.randomUUID() format like "aec4e0ec3c4f4557b8ce46e55078fc95"
 * @param uuid
 * @returns
 */
export function is32CharHex(uuid: string) {
  const hexRegex = /^[0-9a-fA-F]{32}$/;
  return hexRegex.test(uuid);
}
