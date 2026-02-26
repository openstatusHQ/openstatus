import type { ChartConfig } from "@openstatus/ui/components/ui/chart";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

import { cn } from "@openstatus/ui/lib/utils";

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
  style,
  className,
}: {
  value: ValueType;
  label: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)",
          className,
        )}
        style={style}
      />
      <span>{label}</span>
      <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
        {value}
        <span className="text-muted-foreground font-normal">ms</span>
      </div>
    </>
  );
}
