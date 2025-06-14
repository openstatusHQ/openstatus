import type { ChartConfig } from "@/components/ui/chart";
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
        {chartConfig[name as keyof typeof chartConfig]?.label || name}
      </span>
      <div className="ml-auto flex items-baseline gap-0.5 font-medium font-mono text-foreground tabular-nums">
        {value}
        <span className="font-normal text-muted-foreground">ms</span>
      </div>
    </>
  );
}
