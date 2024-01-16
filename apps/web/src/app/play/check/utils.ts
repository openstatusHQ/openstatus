import { z } from "zod";

import { flyRegions } from "@openstatus/db/src/schema";
import type { MonitorFlyRegion } from "@openstatus/db/src/schema";
import { flyRegionsDict } from "@openstatus/utils";

export function valueFormatter(value: number) {
  return `${new Intl.NumberFormat("us").format(value).toString()}ms`;
}

export function regionFormatter(region: MonitorFlyRegion) {
  const { code, flag } = flyRegionsDict[region];
  return `${code} ${flag}`;
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

export type Timing = z.infer<typeof timingSchema>;
export type Checker = z.infer<typeof checkerSchema>;
export type RegionChecker = Checker & { region: MonitorFlyRegion };

export async function checkPlaygroundURL(
  url: string,
  region: MonitorFlyRegion,
) {
  const res = await fetch(`https://checker.openstatus.dev/ping/${region}`, {
    headers: {
      "Content-Type": "application/json",
      // TODO: move to @/env
      "x-openstatus-key": process.env.PLAYGROUND_UNKEY_API_KEY!,
    },
    method: "POST",
    body: JSON.stringify({ url, method: "GET" }),
    // cache: "force-cache",
    next: { revalidate: 3600 },
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

export async function checkAllRegions(url: string) {
  // TODO: settleAll
  return Promise.all(
    flyRegions.map((region) => checkPlaygroundURL(url, region)),
  );
}
