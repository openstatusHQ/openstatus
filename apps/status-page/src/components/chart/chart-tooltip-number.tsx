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
  const label: React.ReactNode = labelFormatter
    ? labelFormatter(value, name)
    : chartConfig[name as keyof typeof chartConfig]?.label || name;

  return (
    <>
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-(--radius-xs) bg-(--color-bg)"
        style={
          {
            "--color-bg": `var(--color-${name})`,
          } as React.CSSProperties
        }
      />
      <span>{label}</span>
      <div className="ml-auto flex items-baseline gap-0.5 font-medium font-mono text-foreground tabular-nums">
        {value}
        <span className="font-normal text-muted-foreground">ms</span>
      </div>
    </>
  );
}
