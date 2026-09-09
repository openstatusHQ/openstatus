// Kept free of drizzle imports so `"use client"` files can pull the enums
// without dragging the schema graph into the browser bundle.
export const incidentStatus = [
  "triage",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

export const incidentOrigin = ["monitor", "external", "manual"] as const;

export const incidentSeverity = ["critical", "warning", "info"] as const;
