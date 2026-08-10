// Kept free of drizzle imports so `"use client"` files can pull the enum
// without dragging the schema graph into the browser bundle.
export const statusReportStatus = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
