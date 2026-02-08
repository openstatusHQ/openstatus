import { Badge } from "@openstatus/ui/components/ui/badge";
import { Separator } from "@openstatus/ui/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceStrict } from "date-fns";
import { Check } from "lucide-react";
import {
  formatDateRange,
  incidentStatusLabels,
  formatDate,
  formatDateTime,
} from "@openstatus/ui/components/blocks/status.utils";
import type { StatusReportUpdateType } from "@openstatus/ui/components/blocks/status.types";
import { StatusTimestamp } from "@openstatus/ui/components/blocks/status-timestamp";

export function StatusEventGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      role="feed"
      aria-label="Status events and updates"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEvent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("relative flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusEventContent({
  className,
  hoverable = true,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  hoverable?: boolean;
}) {
  return (
    <div
      data-hoverable={hoverable}
      className={cn(
        "group -mx-3 -my-2 flex flex-col gap-2 rounded-lg border border-transparent px-3 py-2",
        "data-[hoverable=true]:hover:cursor-pointer data-[hoverable=true]:hover:border-border/50 data-[hoverable=true]:hover:bg-muted/50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-medium", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusEventTitleCheck({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center pl-1", className)} {...props}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger aria-label="Report resolved">
            <div className="rounded-full border border-success/20 bg-success/10 p-0.5 text-success">
              <Check className="size-3 shrink-0" aria-hidden="true" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Report resolved</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function StatusEventAffected({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusEventAffectedBadge({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px]", className)}
      {...props}
    >
      {children}
    </Badge>
  );
}

export function StatusEventDate({
  className,
  date,
  ...props
}: React.ComponentProps<"div"> & {
  date: Date;
}) {
  const isFuture = date > new Date();
  const distance = formatDistanceStrict(date, new Date(), { addSuffix: true });
  return (
    <div className={cn("flex gap-2 lg:flex-col", className)} {...props}>
      <div className="font-medium text-foreground">
        {formatDate(date, { month: "short" })}
      </div>{" "}
      <Badge
        variant="secondary"
        className={cn(
          "text-[10px]",
          isFuture ? "bg-info text-background dark:text-foreground" : "",
        )}
      >
        {distance}
      </Badge>
    </div>
  );
}

export function StatusEventAside({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className="lg:-left-32 border border-transparent lg:absolute lg:top-0 lg:h-full">
      <div className={cn("lg:sticky lg:top-0 lg:left-0", className)} {...props}>
        {children}
      </div>
    </div>
  );
}

interface StatusReportUpdate {
  date: Date;
  message: string;
  status: StatusReportUpdateType;
}

export function StatusEventTimelineReport({
  className,
  updates,
  withDot = true,
  maxUpdates,
  ...props
}: React.ComponentProps<"div"> & {
  updates: StatusReportUpdate[];
  withDot?: boolean;
  maxUpdates?: number;
}) {
  const sortedUpdates = [...updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const displayedUpdates = maxUpdates
    ? sortedUpdates.slice(0, maxUpdates)
    : sortedUpdates;

  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
      {/* NOTE: make sure they are sorted by date */}
      {displayedUpdates.map((update, index) => {
        const updateDate = new Date(update.date);
        let durationText: string | undefined;

        if (index === 0) {
          const startedAt = new Date(
            sortedUpdates[sortedUpdates.length - 1].date,
          );
          const duration = formatDistanceStrict(startedAt, updateDate);

          if (duration !== "0 seconds" && update.status === "resolved") {
            durationText = `(in ${duration})`;
          }
        } else {
          const lastUpdateDate = new Date(displayedUpdates[index - 1].date);
          const timeFromLast = formatDistanceStrict(updateDate, lastUpdateDate);
          durationText = `(${timeFromLast} earlier)`;
        }

        return (
          <StatusEventTimelineReportUpdate
            key={index}
            report={update}
            duration={durationText}
            withSeparator={index !== displayedUpdates.length - 1}
            withDot={withDot}
            isLast={index === displayedUpdates.length - 1}
          />
        );
      })}
    </div>
  );
}

export function StatusEventTimelineReportUpdate({
  report,
  duration,
  withSeparator = true,
  withDot = true,
  isLast = false,
}: {
  report: StatusReportUpdate;
  withSeparator?: boolean;
  duration?: string;
  withDot?: boolean;
  isLast?: boolean;
}) {
  return (
    <div data-variant={report.status} className="group">
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-row gap-4">
          {withDot ? (
            <div className="flex flex-col">
              <div className="flex h-5 flex-col items-center justify-center">
                <StatusEventTimelineDot />
              </div>
              {withSeparator ? <StatusEventTimelineSeparator /> : null}
            </div>
          ) : null}
          <div className={cn(isLast ? "mb-0" : "mb-2")}>
            <StatusEventTimelineTitle>
              <span>{incidentStatusLabels[report.status]}</span>{" "}
              <span className="text-muted-foreground/70">·</span>{" "}
              <span className="font-mono text-muted-foreground text-xs">
                <StatusTimestamp date={report.date} variant="rich" asChild>
                  <span>{formatDateTime(report.date)}</span>
                </StatusTimestamp>
              </span>{" "}
              {duration ? (
                <span className="font-mono text-muted-foreground/70 text-xs">
                  {duration}
                </span>
              ) : null}
            </StatusEventTimelineTitle>
            <StatusEventTimelineMessage>
              {report.message.trim() === "" ? (
                <span className="text-muted-foreground/70">-</span>
              ) : (
                // NOTE: App should wrap this with ProcessMessage if needed
                <span>{report.message}</span>
              )}
            </StatusEventTimelineMessage>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatusMaintenanceUpdate {
  title: string;
  message: string;
  from: Date;
  to: Date;
}

export function StatusEventTimelineMaintenance({
  maintenance,
  withDot = true,
}: {
  maintenance: StatusMaintenanceUpdate;
  withDot?: boolean;
}) {
  const duration = formatDistanceStrict(maintenance.from, maintenance.to);
  const range = formatDateRange(maintenance.from, maintenance.to);
  // NOTE: because formatDateRange is sure to return a range, we can split it into two dates
  const [from, to] = range.split(" - ");
  return (
    <div data-variant="maintenance" className="group">
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-row gap-4">
          {withDot ? (
            <div className="flex flex-col">
              <div className="flex h-5 flex-col items-center justify-center">
                <StatusEventTimelineDot />
              </div>
            </div>
          ) : null}
          {/* NOTE: is always last, no need for className="mb-2" */}
          <div>
            <StatusEventTimelineTitle>
              <span>{maintenance.title}</span>{" "}
              <span className="text-muted-foreground/70">·</span>{" "}
              <span className="font-mono text-muted-foreground text-xs">
                <StatusTimestamp
                  date={maintenance.from}
                  variant="rich"
                  asChild
                >
                  <span>{from}</span>
                </StatusTimestamp>
                {" - "}
                <StatusTimestamp date={maintenance.to} variant="rich" asChild>
                  <span>{to}</span>
                </StatusTimestamp>
              </span>{" "}
              {duration ? (
                <span className="font-mono text-muted-foreground/70 text-xs">
                  (for {duration})
                </span>
              ) : null}
            </StatusEventTimelineTitle>
            <StatusEventTimelineMessage>
              {maintenance.message.trim() === "" ? (
                <span className="text-muted-foreground/70">-</span>
              ) : (
                maintenance.message
              )}
            </StatusEventTimelineMessage>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusEventTimelineTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("font-medium text-foreground text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTimelineMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "py-1.5 font-mono text-muted-foreground text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTimelineDot({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "size-2.5 shrink-0 rounded-full bg-muted",
        "group-data-[variant=resolved]:bg-success",
        "group-data-[variant=monitoring]:bg-info",
        "group-data-[variant=identified]:bg-warning",
        "group-data-[variant=investigating]:bg-destructive",
        "group-data-[variant=maintenance]:bg-info",
        className,
      )}
      {...props}
    />
  );
}

export function StatusEventTimelineSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      orientation="vertical"
      className={cn(
        "mx-auto flex-1",
        "group-data-[variant=resolved]:bg-success",
        "group-data-[variant=monitoring]:bg-info",
        "group-data-[variant=identified]:bg-warning",
        "group-data-[variant=investigating]:bg-destructive",
        "group-data-[variant=maintenance]:bg-info",
        className,
      )}
      {...props}
    />
  );
}
