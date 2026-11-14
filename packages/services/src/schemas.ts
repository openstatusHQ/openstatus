import { z } from "zod";

/** Percent above 0 and at most 100, to three decimals like targets. */
export const SlaPercentInput = z
  .number()
  .positive()
  .max(100)
  .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, {
    message: "Use at most three decimals.",
  });
