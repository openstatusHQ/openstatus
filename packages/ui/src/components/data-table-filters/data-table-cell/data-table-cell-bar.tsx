import { hexToRgb } from "@openstatus/ui/lib/data-table-filters/colors";

const OPACITY = 0.5;
const BORDER_OPACITY = 1;

export function DataTableCellBar({
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

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <div className="relative -m-2 p-2">
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${ratio * 100}%`,
          backgroundColor: color
            ? `rgba(${hexToRgb(color)}, ${OPACITY})`
            : `var(--muted)`,
          opacity: color ? undefined : OPACITY,
          borderRight: `1px solid ${color ? `rgba(${hexToRgb(color)}, ${BORDER_OPACITY})` : `var(--border)`}`,
        }}
      />
      <span className="relative font-mono">
        {formatted}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}
