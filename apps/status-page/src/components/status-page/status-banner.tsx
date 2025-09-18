import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  CheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { messages } from "./messages";
import { StatusTimestamp } from "./status";

export function StatusBanner({
  className,
  status,
}: React.ComponentProps<"div"> & {
  status?: "success" | "degraded" | "error" | "info";
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
  status?: "success" | "degraded" | "error" | "info";
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
        {messages.long.success}
      </span>
      <span className="hidden group-data-[status=degraded]/status-banner:block">
        {messages.long.degraded}
      </span>
      <span className="hidden group-data-[status=error]/status-banner:block">
        {messages.long.error}
      </span>
      <span className="hidden group-data-[status=info]/status-banner:block">
        {messages.long.info}
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
    <div className={cn("px-3 py-2 sm:px-4 sm:py-3", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusBannerIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-muted text-background [&>svg]:size-4",
        "group-data-[status=success]/status-banner:bg-success",
        "group-data-[status=degraded]/status-banner:bg-warning",
        "group-data-[status=error]/status-banner:bg-destructive",
        "group-data-[status=info]/status-banner:bg-info",
        className,
      )}
      {...props}
    >
      <CheckIcon className="hidden group-data-[status=success]/status-banner:block" />
      <TriangleAlertIcon className="hidden group-data-[status=degraded]/status-banner:block" />
      <AlertCircleIcon className="hidden group-data-[status=error]/status-banner:block" />
      <WrenchIcon className="hidden group-data-[status=info]/status-banner:block" />
    </div>
  );
}

// Tabs Components

export function StatusBannerTabs({
  className,
  children,
  status,
  ...props
}: React.ComponentProps<typeof Tabs> & {
  status?: "success" | "degraded" | "error" | "info";
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
    <div className={cn("rounded-t-lg", "w-full max-w-full overflow-x-auto")}>
      <TabsList
        className={cn(
          "p-0 rounded-t-lg rounded-none",
          "border-none w-max min-w-full",
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
  status?: "success" | "degraded" | "error" | "info";
}) {
  return (
    <TabsTrigger
      data-slot="status-banner-tabs-trigger"
      data-status={status}
      className={cn(
        "font-mono",
        "rounded-none border-none focus-visible:ring-inset",
        "text-foreground h-full dark:text-foreground data-[state=active]:text-background dark:data-[state=active]:text-background",
        "data-[status=success]:bg-success/50 dark:data-[status=success]:bg-success/50 data-[state=active]:data-[status=success]:bg-success dark:data-[state=active]:data-[status=success]:bg-success",
        "data-[status=degraded]:bg-warning/50 dark:data-[status=degraded]:bg-warning/50 data-[state=active]:data-[status=degraded]:bg-warning dark:data-[state=active]:data-[status=degraded]:bg-warning",
        "data-[status=error]:bg-destructive/50 dark:data-[status=error]:bg-destructive/50 data-[state=active]:data-[status=error]:bg-destructive dark:data-[state=active]:data-[status=error]:bg-destructive",
        "data-[status=info]:bg-info/50 dark:data-[status=info]:bg-info/50 data-[state=active]:data-[status=info]:bg-info dark:data-[state=active]:data-[status=info]:bg-info",
        "data-[state=active]:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  );
}

// NOTE: tabing into content is not being highlighted
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
