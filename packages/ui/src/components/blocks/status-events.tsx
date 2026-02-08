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

// ============================================================================
// Container Components
// ============================================================================

/**
 * StatusEventGroup - Root container for status events and incident reports
 *
 * Provides a vertical flex container with consistent spacing (gap-4) for
 * displaying a feed of status events, incident reports, and maintenance notices.
 * The component includes ARIA role="feed" for accessibility.
 *
 * @example
 * ```tsx
 * <StatusEventGroup>
 *   <StatusEvent>
 *     // First incident...
 *   </StatusEvent>
 *   <StatusEvent>
 *     // Second incident...
 *   </StatusEvent>
 * </StatusEventGroup>
 * ```
 *
 * @see StatusEvent - For individual event items
 */
export function StatusEventGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-group"
      className={cn("flex flex-col gap-4", className)}
      role="feed"
      aria-label="Status events and updates"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * StatusEvent - Individual event container within StatusEventGroup
 *
 * Container for a single event (incident, report, or maintenance) with relative
 * positioning to support absolutely positioned date aside elements.
 *
 * @example
 * ```tsx
 * <StatusEvent>
 *   <StatusEventAside>
 *     <StatusEventDate date={new Date()} />
 *   </StatusEventAside>
 *   <StatusEventContent>
 *     <StatusEventTitle>API Outage</StatusEventTitle>
 *     // Event details...
 *   </StatusEventContent>
 * </StatusEvent>
 * ```
 */
export function StatusEvent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event"
      className={cn("relative flex flex-col gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Content Components
// ============================================================================

/**
 * StatusEventContent - Main content container for event details
 *
 * Provides a hoverable container with rounded borders and muted background on hover.
 * The hoverable behavior can be disabled for non-interactive events.
 *
 * @param hoverable - Whether to show hover effects (default: true)
 *
 * @example
 * ```tsx
 * <StatusEventContent>
 *   <StatusEventTitle>Database Maintenance</StatusEventTitle>
 *   <p>Scheduled maintenance from 2-4 AM UTC</p>
 * </StatusEventContent>
 * ```
 */
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
      data-slot="status-event-content"
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

/**
 * StatusEventTitle - Title for status events
 *
 * Displays the event title in medium-weight font, typically used for incident
 * names or maintenance titles.
 *
 * @example
 * ```tsx
 * <StatusEventTitle>API Gateway Outage</StatusEventTitle>
 * ```
 */
export function StatusEventTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-title"
      className={cn("font-medium", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * StatusEventTitleCheck - Resolved status indicator with tooltip
 *
 * Displays a green check icon in a circular badge with a tooltip explaining
 * that the report has been resolved. Typically displayed next to event titles.
 *
 * @example
 * ```tsx
 * <div className="flex items-center gap-2">
 *   <StatusEventTitle>API Outage</StatusEventTitle>
 *   <StatusEventTitleCheck />
 * </div>
 * ```
 */
export function StatusEventTitleCheck({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-title-check"
      className={cn("flex items-center pl-1", className)}
      {...props}
    >
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

// ============================================================================
// Affected Services Components
// ============================================================================

/**
 * StatusEventAffected - Container for affected service badges
 *
 * Displays a wrapping flex container for StatusEventAffectedBadge components,
 * showing which services were impacted by an incident.
 *
 * @example
 * ```tsx
 * <StatusEventAffected>
 *   <StatusEventAffectedBadge>API</StatusEventAffectedBadge>
 *   <StatusEventAffectedBadge>Database</StatusEventAffectedBadge>
 *   <StatusEventAffectedBadge>CDN</StatusEventAffectedBadge>
 * </StatusEventAffected>
 * ```
 */
export function StatusEventAffected({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-affected"
      className={cn("flex flex-wrap gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * StatusEventAffectedBadge - Badge for individual affected service
 *
 * Displays a small secondary-style badge representing a single affected service.
 * Uses a smaller font size (text-[10px]) for compact display.
 *
 * @example
 * ```tsx
 * <StatusEventAffectedBadge>REST API</StatusEventAffectedBadge>
 * ```
 */
export function StatusEventAffectedBadge({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Badge
      data-slot="status-event-affected-badge"
      variant="secondary"
      className={cn("text-[10px]", className)}
      {...props}
    >
      {children}
    </Badge>
  );
}

// ============================================================================
// Date/Time Components
// ============================================================================

/**
 * StatusEventDate - Date display with relative time badge
 *
 * Displays a formatted date with a relative time badge (e.g., "2 days ago").
 * For future dates, the badge is highlighted in info color. The layout is
 * responsive: horizontal on mobile (gap-2), vertical on desktop (flex-col).
 *
 * @param date - The event date to display
 *
 * @example
 * ```tsx
 * <StatusEventDate date={new Date("2024-01-15")} />
 * // Displays: "Jan 15, 2024" with "2 days ago" badge
 * ```
 */
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
    <div
      data-slot="status-event-date"
      className={cn("flex gap-2 lg:flex-col", className)}
      {...props}
    >
      <div className="font-medium text-foreground">
        {formatDate(date, { month: "short" })}
      </div>{" "}
      <Badge
        data-slot="status-event-date-badge"
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

/**
 * StatusEventAside - Sidebar date container (desktop only)
 *
 * Positions the date to the left of event content on desktop screens (lg breakpoint).
 * On mobile, it appears inline. Uses sticky positioning on desktop to keep dates
 * visible while scrolling through long events.
 *
 * @example
 * ```tsx
 * <StatusEvent>
 *   <StatusEventAside>
 *     <StatusEventDate date={incidentDate} />
 *   </StatusEventAside>
 *   <StatusEventContent>
 *     // Event content...
 *   </StatusEventContent>
 * </StatusEvent>
 * ```
 */
export function StatusEventAside({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-aside"
      className="lg:-left-32 border border-transparent lg:absolute lg:top-0 lg:h-full"
    >
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

// ============================================================================
// Timeline Components
// ============================================================================

/**
 * StatusEventTimelineReport - Timeline of incident report updates
 *
 * Displays a chronological timeline of incident updates, sorted from newest to
 * oldest. Each update shows the status (investigating → identified → monitoring → resolved),
 * timestamp, message, and time elapsed between updates.
 *
 * **Automatic Duration Calculation**:
 * - First update (most recent): Shows total time from start to resolution (if resolved)
 * - Other updates: Shows time elapsed since the previous update
 *
 * @param updates - Array of report updates to display
 * @param withDot - Whether to show colored status dots (default: true)
 * @param maxUpdates - Maximum number of updates to display (optional, shows all if not specified)
 *
 * @example
 * ```tsx
 * <StatusEventTimelineReport
 *   updates={[
 *     {
 *       status: "resolved",
 *       message: "All services restored",
 *       date: new Date("2024-01-15T12:00:00Z")
 *     },
 *     {
 *       status: "monitoring",
 *       message: "Fix deployed, monitoring recovery",
 *       date: new Date("2024-01-15T11:45:00Z")
 *     },
 *     {
 *       status: "identified",
 *       message: "Root cause identified in database",
 *       date: new Date("2024-01-15T11:15:00Z")
 *     },
 *     {
 *       status: "investigating",
 *       message: "Investigating API timeouts",
 *       date: new Date("2024-01-15T11:00:00Z")
 *     }
 *   ]}
 * />
 * // Displays timeline with: "Resolved (in 1 hour)" → "Monitoring (15 minutes earlier)" → etc.
 * ```
 *
 * @see StatusEventTimelineReportUpdate - For individual update rendering
 */
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
    <div
      data-slot="status-event-timeline-report"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    >
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

/**
 * StatusEventTimelineReportUpdate - Single update entry in incident timeline
 *
 * Displays one update in the incident timeline with:
 * - Colored dot indicator (red=investigating, yellow=identified, blue=monitoring, green=resolved)
 * - Status label and timestamp (with StatusTimestamp for rich hover details)
 * - Duration text (e.g., "in 1 hour" or "15 minutes earlier")
 * - Update message
 * - Optional vertical separator line connecting to next update
 *
 * @param report - The update data (status, message, date)
 * @param duration - Optional duration text to display
 * @param withSeparator - Whether to show separator line to next update (default: true)
 * @param withDot - Whether to show colored status dot (default: true)
 * @param isLast - Whether this is the last update (affects bottom margin)
 *
 * @example
 * ```tsx
 * <StatusEventTimelineReportUpdate
 *   report={{
 *     status: "resolved",
 *     message: "All systems operational",
 *     date: new Date()
 *   }}
 *   duration="(in 45 minutes)"
 *   withSeparator={false}
 *   isLast={true}
 * />
 * ```
 *
 * @see StatusEventTimelineDot - For the colored dot indicator
 * @see StatusEventTimelineSeparator - For the connecting line
 */
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
    <div
      data-slot="status-event-timeline-report-update"
      data-variant={report.status}
      className="group"
    >
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

/**
 * StatusEventTimelineMaintenance - Timeline entry for maintenance windows
 *
 * Displays a maintenance window with title, date range, duration, and message.
 * Uses a blue dot indicator to distinguish from incident updates.
 *
 * The date range is formatted and split to allow individual StatusTimestamp
 * components for each date, providing rich hover details.
 *
 * @param maintenance - The maintenance data (title, message, from, to dates)
 * @param withDot - Whether to show the blue maintenance dot (default: true)
 *
 * @example
 * ```tsx
 * <StatusEventTimelineMaintenance
 *   maintenance={{
 *     title: "Database Upgrade",
 *     message: "Upgrading to PostgreSQL 15",
 *     from: new Date("2024-01-20T02:00:00Z"),
 *     to: new Date("2024-01-20T04:00:00Z")
 *   }}
 * />
 * // Displays: [●] Database Upgrade · Jan 20, 2:00 AM - 4:00 AM (for 2 hours)
 * //           Upgrading to PostgreSQL 15
 * ```
 *
 * @see StatusEventTimelineDot - For the colored indicator
 * @see StatusTimestamp - For rich timestamp hover cards
 */
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
    <div
      data-slot="status-event-timeline-maintenance"
      data-variant="maintenance"
      className="group"
    >
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
                <StatusTimestamp date={maintenance.from} variant="rich" asChild>
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

/**
 * StatusEventTimelineTitle - Title line for timeline entries
 *
 * Displays the title line of timeline entries with medium font weight,
 * typically containing status label, timestamp, and duration.
 *
 * @example
 * ```tsx
 * <StatusEventTimelineTitle>
 *   <span>Resolved</span> · <span>Jan 15, 10:30 AM</span>
 * </StatusEventTimelineTitle>
 * ```
 */
export function StatusEventTimelineTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-timeline-title"
      className={cn("font-medium text-foreground text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * StatusEventTimelineMessage - Message content for timeline entries
 *
 * Displays the update message in monospace font with muted color and
 * consistent padding.
 *
 * @example
 * ```tsx
 * <StatusEventTimelineMessage>
 *   We have identified the root cause and deployed a fix
 * </StatusEventTimelineMessage>
 * ```
 */
export function StatusEventTimelineMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-timeline-message"
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

/**
 * StatusEventTimelineDot - Colored status indicator dot
 *
 * Displays a small circular dot with color based on the parent's data-variant:
 * - investigating: Red (destructive)
 * - identified: Yellow (warning)
 * - monitoring: Blue (info)
 * - resolved: Green (success)
 * - maintenance: Blue (info)
 *
 * @example
 * ```tsx
 * <div data-variant="resolved">
 *   <StatusEventTimelineDot />
 *   // Displays green dot
 * </div>
 * ```
 */
export function StatusEventTimelineDot({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-event-timeline-dot"
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

/**
 * StatusEventTimelineSeparator - Vertical line connecting timeline entries
 *
 * Displays a vertical separator line between timeline updates, colored to match
 * the status of the update it's connected to. Uses the same color scheme as
 * StatusEventTimelineDot.
 *
 * @example
 * ```tsx
 * <div data-variant="monitoring">
 *   <StatusEventTimelineDot />
 *   <StatusEventTimelineSeparator />
 *   // Displays blue connecting line
 * </div>
 * ```
 */
export function StatusEventTimelineSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="status-event-timeline-separator"
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
