import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { VariantType } from "./floating-button";
import { StatusMonitorIcon, StatusMonitorStatus } from "./status-monitor";

export function StatusTrackerGroup({
  children,
  title,
  variant,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
  variant?: VariantType;
}) {
  return (
    <Collapsible
      className={cn(
        "-mx-3",
        "rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/50 data-[state=open]:border-border/50 data-[state=open]:bg-muted/50",
        className,
      )}
    >
      <CollapsibleTrigger
        className={cn(
          "group/monitor flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 font-medium",
          "cursor-pointer",
          className,
        )}
        data-variant={variant}
        {...props}
      >
        {title}
        <div className="flex items-center gap-2">
          <StatusMonitorStatus className="text-sm" />
          <StatusMonitorIcon />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "flex flex-col gap-3 border-border/50 border-t px-3 py-2",
          "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
