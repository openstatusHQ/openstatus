import { UTCDate } from "@date-fns/utc";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import { format } from "date-fns";
import { systemStatusLabels } from "@openstatus/ui/components/blocks/status.utils";
import { StatusIcon as UnifiedStatusIcon } from "@openstatus/ui/components/blocks/status-icon";
import type { StatusType } from "@openstatus/ui/components/blocks/status.types";

export function StatusBanner({
  className,
  status,
}: React.ComponentProps<"div"> & {
  status?: Exclude<StatusType, "empty">;
}) {
  return (
    <StatusBannerContainer
      status={status}
      className={cn(
        "flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3",
        "data-[status=success]:bg-success/20",
        "data-[status=degraded]:bg-warning/20",
        "data-[status=error]:bg-destructive/20",
        "data-[status=info]:bg-info/20",
        className,
      )}
    >
      <StatusBannerIcon className="flex-shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <StatusBannerMessage className="font-semibold text-xl" />
        <StatusTimestamp date={new Date()} className="text-xs" />
      </div>
    </StatusBannerContainer>
  );
}

export function StatusBannerContainer({
  className,
  children,
  status,
}: React.ComponentProps<"div"> & {
  status?: Exclude<StatusType, "empty">;
}) {
  return (
    <div
      data-slot="status-banner"
      data-status={status}
      className={cn(
        "group/status-banner overflow-hidden rounded-lg border",
        "data-[status=success]:border-success data-[status=success]:bg-success/5 dark:data-[status=success]:bg-success/10",
        "data-[status=degraded]:border-warning data-[status=degraded]:bg-warning/5 dark:data-[status=degraded]:bg-warning/10",
        "data-[status=error]:border-destructive data-[status=error]:bg-destructive/5 dark:data-[status=error]:bg-destructive/10",
        "data-[status=info]:border-info data-[status=info]:bg-info/5 dark:data-[status=info]:bg-info/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusBannerMessage({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(className)} {...props}>
      <span className="hidden group-data-[status=success]/status-banner:block">
        {systemStatusLabels.success.long}
      </span>
      <span className="hidden group-data-[status=degraded]/status-banner:block">
        {systemStatusLabels.degraded.long}
      </span>
      <span className="hidden group-data-[status=error]/status-banner:block">
        {systemStatusLabels.error.long}
      </span>
      <span className="hidden group-data-[status=info]/status-banner:block">
        {systemStatusLabels.info.long}
      </span>
    </div>
  );
}

export function StatusBannerTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-3 py-2 font-medium text-background",
        "group-data-[status=success]/status-banner:bg-success",
        "group-data-[status=degraded]/status-banner:bg-warning",
        "group-data-[status=error]/status-banner:bg-destructive",
        "group-data-[status=info]/status-banner:bg-info",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBannerContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 px-3 py-2 sm:px-4 sm:py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBannerIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon variant="banner" className={className} {...props} />
  );
}

// Tabs Components

export function StatusBannerTabs({
  className,
  children,
  status,
  ...props
}: React.ComponentProps<typeof Tabs> & {
  status?: Exclude<StatusType, "empty">;
}) {
  return (
    <Tabs
      data-slot="status-banner-tabs"
      data-status={status}
      className={cn(
        "gap-0",
        "data-[status=success]:bg-success/20",
        "data-[status=degraded]:bg-warning/20",
        "data-[status=error]:bg-destructive/20",
        "data-[status=info]:bg-info/20",
        className,
      )}
      {...props}
    >
      {children}
    </Tabs>
  );
}

export function StatusBannerTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <div className={cn("rounded-t-lg", "w-full overflow-x-auto")}>
      <TabsList
        className={cn(
          "rounded-none rounded-t-lg p-0",
          "border-none",
          className,
        )}
        {...props}
      >
        {children}
      </TabsList>
    </div>
  );
}

export function StatusBannerTabsTrigger({
  className,
  children,
  status,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & {
  status?: Exclude<StatusType, "empty">;
}) {
  return (
    <TabsTrigger
      data-slot="status-banner-tabs-trigger"
      data-status={status}
      className={cn(
        "font-mono",
        "rounded-none border-none focus-visible:ring-inset",
        "h-full text-foreground data-[state=active]:text-background dark:text-foreground dark:data-[state=active]:text-background",
        "data-[state=active]:data-[status=success]:bg-success data-[status=success]:bg-success/50 dark:data-[state=active]:data-[status=success]:bg-success dark:data-[status=success]:bg-success/50",
        "data-[state=active]:data-[status=degraded]:bg-warning data-[status=degraded]:bg-warning/50 dark:data-[state=active]:data-[status=degraded]:bg-warning dark:data-[status=degraded]:bg-warning/50",
        "data-[state=active]:data-[status=error]:bg-destructive data-[status=error]:bg-destructive/50 dark:data-[state=active]:data-[status=error]:bg-destructive dark:data-[status=error]:bg-destructive/50",
        "data-[state=active]:data-[status=info]:bg-info data-[status=info]:bg-info/50 dark:data-[state=active]:data-[status=info]:bg-info dark:data-[status=info]:bg-info/50",
        "data-[state=active]:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  );
}

export function StatusBannerTabsContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent className={cn("-mx-3", className)} {...props}>
      {children}
    </TabsContent>
  );
}

export function StatusTimestamp({
  date,
  className,
  ...props
}: React.ComponentProps<typeof TooltipTrigger> & { date: Date }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "font-mono text-muted-foreground underline decoration-muted-foreground/30 decoration-dashed underline-offset-4",
            className,
          )}
          {...props}
        >
          {format(new UTCDate(date), "LLL dd, y HH:mm (z)")}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono">{format(date, "LLL dd, y HH:mm (z)")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
