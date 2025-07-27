import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  CheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { useState } from "react";
import type { CardType, VariantType } from "./floating-button";
import { StatusTracker } from "./status-tracker";

export function StatusMonitor({
  className,
  variant = "success",
  type = "detailed",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: VariantType;
  type?: CardType;
}) {
  return (
    <div
      data-slot="status-monitor"
      data-variant={variant}
      className={cn("group/monitor flex flex-col gap-1", className)}
      {...props}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-row items-center gap-2">
          <StatusMonitorTitle />
          <StatusMonitorDescription />
        </div>
        <div className="flex flex-row items-center gap-2">
          {type === "detailed" ? <StatusMonitorUptime /> : null}
          <StatusMonitorIcon />
        </div>
      </div>
      <StatusTracker type={type} />
    </div>
  );
}

export function StatusMonitorTitle({ ...props }: React.ComponentProps<"div">) {
  return <div {...props}>StatusMonitorTitle</div>;
}

export function StatusMonitorDescription({
  onClick,
  ...props
}: React.ComponentProps<typeof TooltipTrigger>) {
  const isTouch = useMediaQuery("(hover: none)");
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          onClick={(e) => {
            if (isTouch) setOpen((prev) => !prev);
            onClick?.(e);
          }}
          {...props}
        >
          <InfoIcon className="size-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p>API used to ...</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
export function StatusMonitorIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-4 items-center justify-center rounded-full bg-muted text-background [&>svg]:size-2.5",
        "group-data-[variant=success]/monitor:bg-success",
        "group-data-[variant=degraded]/monitor:bg-warning",
        "group-data-[variant=error]/monitor:bg-destructive",
        "group-data-[variant=info]/monitor:bg-info",
        className,
      )}
      {...props}
    >
      <CheckIcon className="hidden group-data-[variant=success]/monitor:block" />
      <TriangleAlertIcon className="hidden group-data-[variant=degraded]/monitor:block" />
      <AlertCircleIcon className="hidden group-data-[variant=error]/monitor:block" />
      <WrenchIcon className="hidden group-data-[variant=info]/monitor:block" />
    </div>
  );
}
export function StatusMonitorUptime({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("font-mono text-muted-foreground text-sm", className)}
    >
      99.89%
    </div>
  );
}
