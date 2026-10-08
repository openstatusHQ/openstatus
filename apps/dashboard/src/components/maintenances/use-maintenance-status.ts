"use client";

import { useEffect, useState } from "react";

import {
  type MaintenanceStatus,
  getMaintenanceStatus,
} from "@/data/overview-events.client";

// setTimeout overflows past 2^31-1 ms and would fire immediately.
const MAX_DELAY = 2 ** 31 - 1;

/** `getMaintenanceStatus`, re-evaluated when `from` or `to` passes. */
export function useMaintenanceStatus(maintenance: {
  from: Date;
  to: Date;
}): MaintenanceStatus {
  const [now, setNow] = useState(() => new Date());
  const from = maintenance.from.getTime();
  const to = maintenance.to.getTime();

  useEffect(() => {
    const next = [from, to].find((t) => t > now.getTime());
    if (next === undefined) return;
    const timer = setTimeout(
      () => setNow(new Date()),
      Math.min(next - now.getTime(), MAX_DELAY),
    );
    return () => clearTimeout(timer);
  }, [from, to, now]);

  return getMaintenanceStatus(maintenance, now);
}
