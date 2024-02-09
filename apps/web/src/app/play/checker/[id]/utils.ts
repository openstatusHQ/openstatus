import { Redis } from "@upstash/redis";
import { z } from "zod";

import { flyRegions, monitorFlyRegionSchema } from "@openstatus/db/src/schema";
import type { MonitorFlyRegion } from "@openstatus/db/src/schema";
import { flyRegionsDict } from "@openstatus/utils";

export function latencyFormatter(value: number) {
  return `${new Intl.NumberFormat("us").format(value).toString()}ms`;
}

export function timestampFormatter(timestamp: number) {
  return new Date(timestamp).toLocaleString(); // TODO: properly format the date
}

export function regionFormatter(
  region: MonitorFlyRegion,
  type: "short" | "long" = "short",
) {
  const { code, flag, location } = flyRegionsDict[region];
  if (type === "short") return `${code} ${flag}`;
  return `${location}`;
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
  status: z.number(),
  latency: z.number(),
  headers: z.record(z.string()),
  time: z.number(),
  timing: timingSchema,
});

export const cachedCheckerSchema = z.object({
  url: z.string(),
  time: z.number(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  checks: checkerSchema.extend({ region: monitorFlyRegionSchema }).array(),
});

export type Timing = z.infer<typeof timingSchema>;
export type Checker = z.infer<typeof checkerSchema>;
export type RegionChecker = Checker & { region: MonitorFlyRegion };
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "HEAD";

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
          ...acc,
          [key]: value,
        };
      }, {}),
      body: opts?.body,
    }),
    next: { revalidate: 0 },
  });

  const json = await res.json();

  const data = checkerSchema.safeParse(json);

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return {
    region,
    ...data.data,
  };
}

export async function checkAllRegions(url: string, opts?: { method: Method }) {
  // TODO: settleAll
  return await Promise.all(
    flyRegions.map(async (region) => {
      const check = await checkRegion(url, region, opts);
      return check;
    }),
  );
}

// TODO: add opts: { method: Method }
export async function setCheckerData(url: string, opts?: { method: Method }) {
  const redis = Redis.fromEnv();
  const time = new Date().getTime();
  const checks = await checkAllRegions(url, opts);
  const { method } = opts || {};

  const cache = { time, url, checks, method };

  const uuid = crypto.randomUUID().replace(/-/g, "");

  const parsed = cachedCheckerSchema.safeParse(cache);

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  await redis.set(uuid, JSON.stringify(parsed.data), { ex: 86_400 }); // 60 * 60 * 24 = 1d

  return uuid;
}

export async function getCheckerDataById(id: string) {
  const redis = Redis.fromEnv();
  const cache = await redis.get(id);

  if (!cache) {
    return null;
  }

  const parsed = cachedCheckerSchema.safeParse(cache);

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  return parsed.data;
}
