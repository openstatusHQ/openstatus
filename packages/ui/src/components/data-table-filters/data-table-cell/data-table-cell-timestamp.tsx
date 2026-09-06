"use client";

import { HoverCardTimestamp } from "@openstatus/ui/components/data-table-filters/data-table-infinite/hover-card-timestamp";

export function DataTableCellTimestamp({
  date,
  color,
}: {
  date: Date | string | number;
  color?: string;
}) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    <span style={color ? { color } : undefined}>
      <HoverCardTimestamp date={d} />
    </span>
  );
}
