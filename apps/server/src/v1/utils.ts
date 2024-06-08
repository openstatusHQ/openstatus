import { z } from "@hono/zod-openapi";

export const isoDate = z.preprocess((val) => {
  if (val) {
    return new Date(String(val)).toISOString();
  }
  return new Date().toISOString();
}, z.string());

export function isNumberArray<T>(
  monitors: number[] | T[],
): monitors is number[] {
  return (
    Array.isArray(monitors) &&
    monitors.every((item) => typeof item === "number")
  );
}
