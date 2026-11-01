"use client";

import { useEffect, useReducer } from "react";

import {
  type MaintenanceStatus,
  getMaintenanceStatus,
} from "@/data/overview-events.client";

// setTimeout overflows past 2^31-1 ms and would fire immediately.
const MAX_DELAY = 2 ** 31 - 1;

/** Re-renders when the next `from` or `to` passes. */
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
    const timer = setTimeout(rerender, Math.min(next - Date.now(), MAX_DELAY));
    return () => clearTimeout(timer);
  }, [next, tick]);
}

/** `getMaintenanceStatus`, re-evaluated when `from` or `to` passes. */
export function useMaintenanceStatus(maintenance: {
  from: Date;
  to: Date;
}): MaintenanceStatus {
  useMaintenanceTick([maintenance]);
  return getMaintenanceStatus(maintenance, new Date());
}
