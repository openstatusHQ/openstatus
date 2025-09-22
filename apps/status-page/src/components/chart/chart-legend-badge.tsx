import { badgeVariants } from "@/components/ui/badge";
import { getPayloadConfigFromPayload, useChart } from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type * as RechartsPrimitive from "recharts";
import type { Payload } from "recharts/types/component/DefaultLegendContent";

export function ChartLegendBadge({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
  handleActive,
  active,
  maxActive,
  annotation,
  tooltip,
}: React.ComponentProps<"div"> &
  Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
    hideIcon?: boolean;
    nameKey?: string;
    // NOTE: additional props compared to default shadcn/ui Legend component
    handleActive?: (item: Payload) => void;
    active?: Payload["dataKey"][];
    maxActive?: number;
    annotation?: Record<string, string | number | undefined>;
    tooltip?: Record<string, string | undefined>;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  const hasMaxActive = active && maxActive ? active.length >= maxActive : false;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload
        // NOTE: recharts supports "none" type for legend items
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const suffix = annotation?.[item.dataKey as string];
          const tooltipLabel = tooltip?.[item.dataKey as string];
          const isActive = active?.includes(item.dataKey);

          const badge = (
            <button
              key={item.value}
              type="button"
              className={cn(
                badgeVariants({ variant: "outline" }),
                "outline-none",
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
                !isActive && "opacity-60",
                !isActive && hasMaxActive && "cursor-not-allowed opacity-40",
              )}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleActive?.(item);
              }}
              disabled={!isActive && hasMaxActive}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-(--radius-xs)"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
              {suffix !== undefined ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </button>
          );

          if (tooltipLabel) {
            return (
              <ChartLegendTooltip key={item.value} tooltip={tooltipLabel}>
                {badge}
              </ChartLegendTooltip>
            );
          }

          return badge;
        })}
    </div>
  );
}

function ChartLegendTooltip({
  children,
  tooltip,
  ...props
}: React.ComponentProps<typeof TooltipTrigger> & { tooltip: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger className="rounded-md" asChild {...props}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
