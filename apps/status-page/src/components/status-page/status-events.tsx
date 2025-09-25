import { ProcessMessage } from "@/components/content/process-message";
import { TimestampHoverCard } from "@/components/content/timestamp-hover-card";
import { Separator } from "@/components/ui/separator";
import { formatDateRange, formatDateTime } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { formatDistanceStrict } from "date-fns";
import { status } from "./messages";

// TODO: rename file to status-event and move the `StatusEvents` component to the page level.

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
  // TODO: add Link
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

// TODO: affected monitors
export function StatusEventAffected({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusEventAside({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className="lg:-left-32 lg:absolute lg:top-0 lg:h-full">
      <div
        className={cn(
          "flex flex-col gap-1 lg:sticky lg:top-0 lg:left-0",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function StatusEventTimelineReport({
  className,
  updates,
  withDot = true,
  ...props
}: React.ComponentProps<"div"> & {
  // TODO: remove unused props
  updates: {
    date: Date;
    message: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
  }[];
  withDot?: boolean;
}) {
  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
      {/* NOTE: make sure they are sorted by date */}
      {updates
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((update, index) => {
          const updateDate = new Date(update.date);
          let durationText: string | undefined;

          if (index === 0) {
            const startedAt = new Date(updates[updates.length - 1].date);
            const duration = formatDistanceStrict(startedAt, updateDate);

            if (duration !== "0 seconds" && update.status === "resolved") {
              durationText = `(in ${duration})`;
            }
          } else {
            const lastUpdateDate = new Date(updates[index - 1].date);
            const timeFromLast = formatDistanceStrict(
              updateDate,
              lastUpdateDate,
            );
            durationText = `(${timeFromLast} earlier)`;
          }

          return (
            <StatusEventTimelineReportUpdate
              key={index}
              report={update}
              duration={durationText}
              withSeparator={index !== updates.length - 1}
              withDot={withDot}
              isLast={index === updates.length - 1}
            />
          );
        })}
    </div>
  );
}

function StatusEventTimelineReportUpdate({
  report,
  duration,
  withSeparator = true,
  withDot = true,
  isLast = false,
}: {
  report: {
    date: Date;
    message: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
  };
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
              <span>{status[report.status]}</span>{" "}
              {/* underline decoration-dashed underline-offset-2 decoration-muted-foreground/30 */}
              <span className="font-mono text-muted-foreground text-xs">
                <TimestampHoverCard date={new Date(report.date)} asChild>
                  <span>{formatDateTime(report.date)}</span>
                </TimestampHoverCard>
              </span>{" "}
              {duration ? (
                <span className="font-mono text-muted-foreground/70 text-xs">
                  {duration}
                </span>
              ) : null}
            </StatusEventTimelineTitle>
            <StatusEventTimelineMessage>
              <ProcessMessage value={report.message} />
            </StatusEventTimelineMessage>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusEventTimelineMaintenance({
  maintenance,
  withDot = true,
}: {
  maintenance: {
    title: string;
    message: string;
    from: Date;
    to: Date;
  };
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
              <span>Maintenance</span>{" "}
              <span className="font-mono text-muted-foreground text-xs">
                <TimestampHoverCard date={maintenance.from} asChild>
                  <span>{from}</span>
                </TimestampHoverCard>
                {" - "}
                <TimestampHoverCard date={maintenance.to} asChild>
                  <span>{to}</span>
                </TimestampHoverCard>
              </span>{" "}
              {duration ? (
                <span className="font-mono text-muted-foreground/70 text-xs">
                  (for {duration})
                </span>
              ) : null}
            </StatusEventTimelineTitle>
            <StatusEventTimelineMessage>
              <ProcessMessage value={maintenance.message} />
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

// TODO: should support markdown
export function StatusEventTimelineMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("py-1.5 font-mono text-foreground/90 text-sm", className)}
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
