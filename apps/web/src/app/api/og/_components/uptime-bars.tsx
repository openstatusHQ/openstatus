import type { DayCell } from "../page/aggregate";

// hex-translated from the design's oklch tokens — satori supports neither
// oklch() nor color-mix()
export const ogColors = {
  bg: "#171717",
  fg: "#fafafa",
  mfg: "#a3a3a3",
  ok: "#22c55e",
  warn: "#f59e0b",
  err: "#f87171",
  info: "#3b82f6",
  dim: "rgba(34,197,94,0.22)",
} as const;

const barColors: Record<DayCell["status"], string> = {
  success: ogColors.ok,
  degraded: ogColors.warn,
  error: ogColors.err,
  info: ogColors.info,
  empty: ogColors.dim,
};

export function UptimeBars({
  days,
  placeholderCount,
  height = 58,
}: {
  days: DayCell[];
  placeholderCount: number;
  height?: number;
}) {
  const cells = days.length
    ? days.map((day) => barColors[day.status])
    : Array.from({ length: placeholderCount }, () => ogColors.dim);

  return (
    <div style={{ display: "flex", gap: 3, width: "100%" }}>
      {cells.map((color, i) => (
        <div
          key={i}
          style={{ flex: 1, height, borderRadius: 3, background: color }}
        />
      ))}
    </div>
  );
}
