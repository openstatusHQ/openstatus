import type { ChartConfig } from "@/components/ui/chart";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

interface ChartTooltipNumberProps {
  chartConfig: ChartConfig;
  value: ValueType;
  name: NameType;
  labelFormatter?: (value: ValueType, name: NameType) => React.ReactNode;
}

export function ChartTooltipNumber({
  value,
  name,
  chartConfig,
  labelFormatter,
}: ChartTooltipNumberProps) {
  return (
    <>
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
        style={
          {
            "--color-bg": `var(--color-${name})`,
          } as React.CSSProperties
        }
      />
      <span>
        {labelFormatter
          ? labelFormatter(value, name)
          : chartConfig[name as keyof typeof chartConfig]?.label || name}
      </span>
      <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
        {value}
        <span className="text-muted-foreground font-normal">ms</span>
      </div>
    </>
  );
}
