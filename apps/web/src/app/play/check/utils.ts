import type { Timing } from "./types";

export function valueFormatter(value: number) {
  return `${new Intl.NumberFormat("us").format(value).toString()}ms`;
}

export function getTotalLatency(timing: Timing) {
  const { dns, connection, tls, ttfb, transfer } = timing;
  return dns + connection + tls + ttfb + transfer;
}
