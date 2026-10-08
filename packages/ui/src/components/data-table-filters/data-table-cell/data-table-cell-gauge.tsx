import { hexToRgb } from "@openstatus/ui/lib/data-table-filters/colors";

const BG_OPACITY = 0.2;
const FOREGROUND_OPACITY = 0.5;

export function DataTableCellGauge({
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

  // SVG circle gauge calculations
  const size = 20;
  const strokeWidth = 4;
  const viewBox = 120;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ratio * circumference;

  const bgStroke = color
    ? `rgba(${hexToRgb(color)}, ${BG_OPACITY})`
    : `var(--muted)`;

  const fgStroke = color
    ? `rgba(${hexToRgb(color)}, ${FOREGROUND_OPACITY})`
    : `var(--muted-foreground)`;

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <div className="flex items-center gap-1.5">
      <svg
        fill="none"
        height={size}
        width={size}
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        className="shrink-0 -rotate-90"
      >
        <circle
          strokeWidth={strokeWidth * 4}
          stroke={bgStroke}
          fill="transparent"
          r={radius}
          cx={viewBox / 2}
          cy={viewBox / 2}
        />
        <circle
          strokeWidth={strokeWidth * 4}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke={fgStroke}
          fill="transparent"
          r={radius}
          cx={viewBox / 2}
          cy={viewBox / 2}
        />
      </svg>
      <span className="font-mono">
        {formatted}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}
