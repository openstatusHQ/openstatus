import type { ChartConfig } from "@openstatus/ui/components/ui/chart";
import { cn } from "@openstatus/ui/lib/utils";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

interface ChartTooltipNumberProps {
  chartConfig: ChartConfig;
  value: ValueType;
  name: NameType;
}

export function ChartTooltipNumber({
  value,
  name,
  chartConfig,
}: ChartTooltipNumberProps) {
  return (
    <ChartTooltipNumberRaw
      value={value}
      label={chartConfig[name as keyof typeof chartConfig]?.label || name}
      style={
        {
          "--color-bg": `var(--color-${name})`,
        } as React.CSSProperties
      }
    />
  );
}

export function ChartTooltipNumberRaw({
  value,
  label,
  unit = "ms",
  style,
  className,
}: {
  value: ValueType;
  label: React.ReactNode;
  /** `null` for values that carry their own unit, such as "2h 32m" */
  unit?: string | null;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-xs bg-(--color-bg)",
          className,
        )}
        style={style}
      />
      <span>{label}</span>
      <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
        {value}
        {unit !== null && (
          <span className="text-muted-foreground font-normal">{unit}</span>
        )}
      </div>
    </>
  );
}
