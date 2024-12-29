import { z } from "@hono/zod-openapi";
import { ZodError } from "zod";

export const isoDate = z.preprocess((val) => {
  try {
    if (val) {
      return new Date(String(val)).toISOString();
    }
    return new Date().toISOString();
  } catch (e) {
    throw new ZodError([
      { code: "invalid_date", message: "Invalid date", path: [] },
    ]);
  }
}, z.string());

export function isNumberArray<T>(
  monitors: number[] | T[],
): monitors is number[] {
  return (
    Array.isArray(monitors) &&
    monitors.every((item) => typeof item === "number")
  );
}
