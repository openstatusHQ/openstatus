import { Separator } from "@/components/ui/separator";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { formatTime } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { UTCDate } from "@date-fns/utc";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import {
  format,
  formatDistanceStrict,
  formatDistanceToNowStrict,
} from "date-fns";
import { Check, Copy } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";

const STATUS_LABELS = {
  resolved: "Resolved",
  monitoring: "Monitoring",
  identified: "Identified",
  investigating: "Investigating",
};

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
  ...props
}: React.ComponentProps<"div"> & {
  // TODO: remove unused props
  updates: {
    date: Date;
    message: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
  }[];
}) {
  const startedAt = new Date(updates[0].date);
  const endedAt = new Date(updates[updates.length - 1].date);
  const duration = formatDistanceStrict(startedAt, endedAt);
  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
      {/* TODO: make sure they are sorted by date */}
      {updates
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((update, index) => (
          <StatusEventTimelineReportUpdate
            key={index}
            report={update}
            duration={
              index === 0 && update.status === "resolved" ? duration : undefined
            }
            withSeparator={index !== updates.length - 1}
          />
        ))}
    </div>
  );
}

function StatusEventTimelineReportUpdate({
  report,
  duration,
  withSeparator = true,
}: {
  report: {
    date: Date;
    message: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
  };
  withSeparator?: boolean;
  duration?: string;
}) {
  return (
    <div data-variant={report.status} className="group">
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-row gap-2">
          <div className="flex flex-col">
            <div className="flex h-5 flex-col items-center justify-center">
              <StatusEventTimelineDot />
            </div>
            {withSeparator ? <StatusEventTimelineSeparator /> : null}
          </div>
          <div className="mb-2">
            <StatusEventTimelineTitle>
              <span>{STATUS_LABELS[report.status]}</span>{" "}
              <span className="font-mono text-muted-foreground/70 text-xs underline decoration-dashed underline-offset-2">
                <StatusEventDateHoverCard date={new Date(report.date)}>
                  {formatTime(report.date)}
                </StatusEventDateHoverCard>
              </span>{" "}
              {duration ? (
                <span className="font-mono text-muted-foreground/70 text-xs">
                  (in {duration})
                </span>
              ) : null}
            </StatusEventTimelineTitle>
            <StatusEventTimelineMessage>
              {report.message}
            </StatusEventTimelineMessage>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusEventTimelineMaintenance({
  maintenance,
}: {
  maintenance: {
    title: string;
    message: string;
    from: Date;
    to: Date;
  };
}) {
  const duration = formatDistanceStrict(maintenance.from, maintenance.to);
  return (
    <div data-variant="maintenance" className="group">
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-row gap-2">
          <div className="flex flex-col">
            <div className="flex h-5 flex-col items-center justify-center">
              <StatusEventTimelineDot />
            </div>
          </div>
          <div className="mb-2">
            <StatusEventTimelineTitle>
              <span>Maintenance</span>{" "}
              <span className="font-mono text-muted-foreground/70 text-xs">
                <span className="underline decoration-dashed underline-offset-2">
                  <StatusEventDateHoverCard date={maintenance.from}>
                    {formatTime(maintenance.from)}
                  </StatusEventDateHoverCard>
                </span>
                {" - "}
                <span className="underline decoration-dashed underline-offset-2">
                  <StatusEventDateHoverCard date={maintenance.to}>
                    {formatTime(maintenance.to)}
                  </StatusEventDateHoverCard>
                </span>
              </span>{" "}
              {duration ? (
                <span className="font-mono text-muted-foreground/70 text-xs">
                  (for {duration})
                </span>
              ) : null}
            </StatusEventTimelineTitle>
            <StatusEventTimelineMessage>
              {maintenance.message}
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
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
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
        "group-data-[variant=operational]:bg-success",
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
        "group-data-[variant=operational]:bg-success",
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

export function StatusEventDateHoverCard({
  date,
  side = "right",
  align = "start",
  alignOffset = -4,
  sideOffset,
  children,
}: React.ComponentProps<typeof HoverCardContent> & { date: Date }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      {/* NOTE: the trigger is an `a` tag per default */}
      <HoverCardTrigger asChild>
        <span>{children}</span>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          className="z-10 w-auto p-2"
          {...{ side, align, alignOffset, sideOffset }}
        >
          <dl className="flex flex-col gap-1">
            <Row value={format(date, "LLL dd, y HH:mm:ss")} label={timezone} />
            <Row
              value={format(new UTCDate(date), "LLL dd, y HH:mm:ss")}
              label="UTC"
            />
            {/* <Row value={date.toISOString()} label="ISO" /> */}
            {/* <Row value={String(date.getTime())} label="Timestamp" /> */}
            <Row
              value={formatDistanceToNowStrict(date, { addSuffix: true })}
              label="Relative"
            />
          </dl>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

function Row({ value, label }: { value: string; label: string }) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <div
      className="group flex items-center justify-between gap-4 text-sm"
      onClick={(e) => {
        e.stopPropagation();
        copy(value, {});
      }}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 truncate font-mono">
        <span className="invisible group-hover:visible">
          {!isCopied ? (
            <Copy className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </span>
        {value}
      </dd>
    </div>
  );
}
