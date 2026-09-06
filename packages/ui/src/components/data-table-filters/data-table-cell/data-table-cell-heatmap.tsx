import { hexToRgb } from "@openstatus/ui/lib/data-table-filters/colors";

const OPACITY = 0.1;

export function DataTableCellHeatmap({
  value,
  min,
  max,
  unit,
  color,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  color?: string;
}) {
  const range = max - min;
  const ratio =
    range === 0 ? 0 : Math.max(0, Math.min(1, (value - min) / range));
  const opacity = ratio * OPACITY;

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <div className="relative -m-2 p-2">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: color
            ? `rgba(${hexToRgb(color)}, ${opacity})`
            : `var(--muted-foreground)`,
          opacity: color ? undefined : opacity,
        }}
      />
      <span className="relative font-mono">
        {formatted}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}
