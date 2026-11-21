"use client";

import { useEffect, useReducer } from "react";

import {
  type MaintenanceStatus,
  getMaintenanceStatus,
} from "@/data/overview-events.client";

// setTimeout overflows past 2^31-1 ms and would fire immediately.
const MAX_DELAY = 2 ** 31 - 1;

/** Re-renders when the next `from` or `to` passes; returns how often that happened. */
export function useMaintenanceTick(maintenances: { from: Date; to: Date }[]) {
  const [tick, rerender] = useReducer((n: number) => n + 1, 0);
  const now = Date.now();
  const next = maintenances
    .flatMap((m) => [m.from.getTime(), m.to.getTime()])
    .filter((t) => t > now)
    .reduce((min, t) => Math.min(min, t), Number.POSITIVE_INFINITY);

  // tick re-arms a timer capped at MAX_DELAY, which fires before `next` moves
  useEffect(() => {
    if (next === Number.POSITIVE_INFINITY) return;
    // 1 ms past the boundary: firing exactly on it would still read the old state
    const delay = Math.min(next - Date.now() + 1, MAX_DELAY);
    const timer = setTimeout(rerender, delay);
    return () => clearTimeout(timer);
  }, [next, tick]);
  return tick;
}

/** `getMaintenanceStatus`, re-evaluated when `from` or `to` passes. */
export function useMaintenanceStatus(maintenance: {
  from: Date;
  to: Date;
}): MaintenanceStatus {
  useMaintenanceTick([maintenance]);
  return getMaintenanceStatus(maintenance, new Date());
}
