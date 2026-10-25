import { EmptyStateContainer } from "@/components/content/empty-state";
import { cn } from "@/lib/utils";

/** Fills a chart's slot at the chart's height so a resolving fetch never shifts the page. */
export function ChartEmpty({
  className,
  children,
  ...props
}: React.ComponentProps<typeof EmptyStateContainer>) {
  return (
    <EmptyStateContainer
      data-slot="chart-empty"
      className={cn("h-[250px] py-2", className)}
      {...props}
    >
      {children}
    </EmptyStateContainer>
  );
}
