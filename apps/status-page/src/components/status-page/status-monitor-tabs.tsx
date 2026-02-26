import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";

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
        "text-foreground dark:text-foreground min-w-0 flex-1 flex-col items-start gap-0.5",
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
        "text-muted-foreground flex min-h-5 flex-row flex-wrap items-center gap-1 text-left text-xs",
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
  return <Skeleton className={cn("h-5 w-24", className)} {...props} />;
}

export function StatusMonitorTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-col gap-2 rounded-lg focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}
