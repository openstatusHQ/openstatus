import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function StatusMonitorTabs({
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return <Tabs className={cn("gap-6", className)} {...props} />;
}

export function StatusMonitorTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn("flex h-auto min-h-fit w-full", className)}
      {...props}
    />
  );
}

export function StatusMonitorTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "min-w-0 flex-1 flex-col items-start gap-0.5 text-foreground dark:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function StatusMonitorTabsTriggerLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("w-full truncate text-left", className)} {...props} />
  );
}

export function StatusMonitorTabsTriggerValue({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center gap-1 text-left text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function StatusMonitorTabsTriggerValueSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-4 w-24", className)} {...props} />;
}

export function StatusMonitorTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent className={cn("flex flex-col gap-2", className)} {...props} />
  );
}
