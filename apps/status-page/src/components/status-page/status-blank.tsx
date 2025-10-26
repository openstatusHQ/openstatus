import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function StatusBlankContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 text-center sm:px-8 sm:py-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBlankTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-medium", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusBlankDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("font-mono text-muted-foreground text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBlankLink({
  children,
  className,
  href,
  ...props
}: React.ComponentProps<typeof Button> & { href: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("text-foreground", className)}
      asChild
      {...props}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function StatusBlankContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusBlankReport({ ...props }: React.ComponentProps<"div">) {
  return (
    <StatusBlankPage {...props}>
      <StatusBlankPageHeader />
      <div className="flex w-full flex-col">
        <StatusBlankReportUpdate />
        <StatusBlankReportUpdate />
      </div>
      <StatusBlankOverlay />
    </StatusBlankPage>
  );
}

export function StatusBlankMonitor({ ...props }: React.ComponentProps<"div">) {
  return (
    <StatusBlankPage {...props}>
      <StatusBlankPageHeader />
      <StatusBlankMonitorUptime />
      <StatusBlankOverlay />
    </StatusBlankPage>
  );
}

export function StatusBlankPage({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex w-full max-w-xs flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-lg border border-border/70 bg-background px-3 py-2 text-center",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBlankPageHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4",
        className,
      )}
      {...props}
    >
      <div className="size-3 rounded-sm bg-accent/60" />
      <div className="flex flex-row gap-1">
        <div className="h-3 w-8 rounded-sm bg-accent/60" />
        <div className="h-3 w-8 rounded-sm bg-accent/60" />
        <div className="h-3 w-8 rounded-sm bg-accent/60" />
      </div>
      <div className="h-3 w-8 rounded-sm bg-accent/60" />
    </div>
  );
}

export function StatusBlankMonitorUptime({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-between gap-1",
        className,
      )}
      {...props}
    >
      <div className="flex w-full flex-row gap-1">
        <div className="h-3 w-8 rounded-sm bg-accent" />
        <div className="h-3 w-12 rounded-sm bg-accent" />
        <div className="h-3 w-10 rounded-sm bg-accent" />
      </div>
      <div className="flex w-full flex-row items-end gap-0.5">
        {Array.from({ length: 30 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-12 flex-1 rounded-sm bg-accent",
              [10, 20].includes(index) && "h-8",
              [25].includes(index) && "h-10",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function StatusBlankReportUpdate({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex w-full items-start gap-2", className)} {...props}>
      <div className="flex h-full flex-col items-center gap-0.5">
        <div className="size-3 rounded-sm bg-accent" />
      </div>
      <div className="flex flex-1 flex-col gap-1 pb-2">
        <div className="flex items-center gap-1">
          <div className="h-3 w-12 rounded-sm bg-accent" />
          <div className="h-3 w-16 rounded-sm bg-accent" />
        </div>
        <div className="h-3 w-full rounded-sm bg-accent" />
        <div className="h-3 w-full rounded-sm bg-accent" />
      </div>
    </div>
  );
}

export function StatusBlankOverlay({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-40% from-transparent to-background p-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBlankEvents({
  title = "No reports found",
  description = "No reports found for this status page.",
  ...props
}: React.ComponentProps<typeof StatusBlankContainer> & {
  title?: string;
  description?: string;
}) {
  return (
    <StatusBlankContainer {...props}>
      <div className="relative mt-8 flex w-full flex-col items-center justify-center">
        <StatusBlankReport className="-top-16 absolute scale-60 opacity-50" />
        <StatusBlankReport className="-top-8 absolute scale-80 opacity-80" />
        <StatusBlankReport />
      </div>
      <StatusBlankContent>
        <StatusBlankTitle>{title}</StatusBlankTitle>
        <StatusBlankDescription>{description}</StatusBlankDescription>
      </StatusBlankContent>
    </StatusBlankContainer>
  );
}

export function StatusBlankMonitors({
  title = "No public monitors",
  description = "No public monitors have been added to this page.",
  ...props
}: React.ComponentProps<typeof StatusBlankContainer> & {
  title?: string;
  description?: string;
}) {
  return (
    <StatusBlankContainer {...props}>
      <div className="relative mt-8 flex w-full flex-col items-center justify-center">
        <StatusBlankMonitor className="-top-16 absolute scale-60 opacity-50" />
        <StatusBlankMonitor className="-top-8 absolute scale-80 opacity-80" />
        <StatusBlankMonitor />
      </div>
      <StatusBlankContent>
        <StatusBlankTitle>{title}</StatusBlankTitle>
        <StatusBlankDescription>{description}</StatusBlankDescription>
      </StatusBlankContent>
    </StatusBlankContainer>
  );
}
