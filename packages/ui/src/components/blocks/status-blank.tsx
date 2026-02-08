import { cn } from "@openstatus/ui/lib/utils";

// ============================================================================
// Container Components
// ============================================================================

/**
 * StatusBlankContainer - Main container for empty state displays
 *
 * Provides a centered, bordered container with muted background for displaying
 * empty state content. The container is responsive with adaptive padding
 * (sm:px-8 sm:py-6) and uses flexbox for vertical centering of content.
 *
 * @example
 * ```tsx
 * <StatusBlankContainer>
 *   <StatusBlankTitle>No Data Available</StatusBlankTitle>
 *   <StatusBlankDescription>Add monitors to see data here</StatusBlankDescription>
 * </StatusBlankContainer>
 * ```
 *
 * @see StatusBlankTitle - For heading text
 * @see StatusBlankDescription - For descriptive text
 */
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

// ============================================================================
// Text Components
// ============================================================================

/**
 * StatusBlankTitle - Title text for empty state displays
 *
 * Displays medium-weight title text within empty state containers.
 * Typically used to communicate the empty state condition.
 *
 * @example
 * ```tsx
 * <StatusBlankTitle>No monitors found</StatusBlankTitle>
 * ```
 *
 * @see StatusBlankDescription - For additional descriptive text
 */
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

/**
 * StatusBlankDescription - Descriptive text for empty state displays
 *
 * Displays muted, monospaced text providing additional context or guidance
 * for the empty state. The monospace font helps distinguish it as secondary
 * instructional text.
 *
 * @example
 * ```tsx
 * <StatusBlankDescription>
 *   Add monitors to this page to see their status here
 * </StatusBlankDescription>
 * ```
 *
 * @see StatusBlankTitle - For primary heading text
 */
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

/**
 * StatusBlankContent - Content wrapper for empty state text
 *
 * Provides vertical spacing (space-y-1) for stacking title and description
 * components within an empty state display.
 *
 * @example
 * ```tsx
 * <StatusBlankContent>
 *   <StatusBlankTitle>No Events</StatusBlankTitle>
 *   <StatusBlankDescription>No events to display</StatusBlankDescription>
 * </StatusBlankContent>
 * ```
 */
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

// ============================================================================
// Visualization Components
// ============================================================================

/**
 * StatusBlankReport - Visual representation of an empty incident report
 *
 * Displays a stylized preview of an incident report page with placeholder
 * header, report updates, and an overlay gradient. Used to visualize what
 * incident reports will look like when created.
 *
 * This component is typically rendered in multiple layers with different
 * scales and opacities to create a stacked card effect.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <StatusBlankReport className="absolute scale-80 opacity-80" />
 *   <StatusBlankReport />
 * </div>
 * ```
 *
 * @see StatusBlankEvents - For composed empty state with stacked reports
 * @see StatusBlankPageHeader - For the header visualization
 * @see StatusBlankReportUpdate - For the update line visualizations
 */
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

/**
 * StatusBlankMonitor - Visual representation of an empty monitor display
 *
 * Displays a stylized preview of a monitor page with placeholder header and
 * uptime visualization bars. Used to show what monitor displays will look like
 * when monitors are added.
 *
 * This component is typically rendered in multiple layers with different
 * scales and opacities to create a stacked card effect.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <StatusBlankMonitor className="absolute scale-80 opacity-80" />
 *   <StatusBlankMonitor />
 * </div>
 * ```
 *
 * @see StatusBlankMonitors - For composed empty state with stacked monitors
 * @see StatusBlankPageHeader - For the header visualization
 * @see StatusBlankMonitorUptime - For the uptime bar visualization
 */
export function StatusBlankMonitor({ ...props }: React.ComponentProps<"div">) {
  return (
    <StatusBlankPage {...props}>
      <StatusBlankPageHeader />
      <StatusBlankMonitorUptime />
      <StatusBlankOverlay />
    </StatusBlankPage>
  );
}

// ============================================================================
// Animation Components (for visualization internals)
// ============================================================================

/**
 * StatusBlankPage - Base container for blank page visualizations
 *
 * Provides a card-like container with border and background for page previews.
 * This component is used as the foundation for StatusBlankReport and
 * StatusBlankMonitor visualizations, providing consistent sizing and styling.
 *
 * The container uses relative positioning to enable absolutely positioned
 * overlay gradients within the visualization.
 *
 * @example
 * ```tsx
 * <StatusBlankPage>
 *   <StatusBlankPageHeader />
 *   <div>// Content here</div>
 *   <StatusBlankOverlay />
 * </StatusBlankPage>
 * ```
 *
 * @see StatusBlankReport - For report visualization using this container
 * @see StatusBlankMonitor - For monitor visualization using this container
 */
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

/**
 * StatusBlankPageHeader - Placeholder header for page visualizations
 *
 * Displays a stylized representation of a page header with placeholder elements
 * for logo, navigation items, and actions. Uses accent-colored rounded rectangles
 * to create a recognizable header pattern.
 *
 * The header shows:
 * - Left: Single square (logo placeholder)
 * - Center: Three rectangles (navigation items)
 * - Right: Single rectangle (action button)
 *
 * @example
 * ```tsx
 * <StatusBlankPage>
 *   <StatusBlankPageHeader />
 *   // Other visualization content
 * </StatusBlankPage>
 * ```
 */
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

/**
 * StatusBlankMonitorUptime - Uptime visualization for monitor previews
 *
 * Displays a stylized uptime chart with placeholder labels and 30 vertical bars
 * representing uptime data. Some bars have varying heights to create a realistic
 * visualization pattern showing occasional incidents.
 *
 * The visualization includes:
 * - Top: Three placeholder labels for time periods
 * - Bottom: 30 vertical bars with most at full height and some shorter to indicate incidents
 *
 * @example
 * ```tsx
 * <StatusBlankMonitor>
 *   <StatusBlankPageHeader />
 *   <StatusBlankMonitorUptime />
 * </StatusBlankMonitor>
 * ```
 */
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

/**
 * StatusBlankReportUpdate - Single update entry for report visualizations
 *
 * Displays a stylized representation of an incident report update with placeholder
 * elements for status indicator, timestamp, and message lines. Creates a timeline-like
 * appearance when stacked vertically.
 *
 * The update shows:
 * - Left: Square status indicator
 * - Right: Two label placeholders (status + timestamp) and two message lines
 *
 * @example
 * ```tsx
 * <StatusBlankPage>
 *   <StatusBlankPageHeader />
 *   <div className="flex flex-col">
 *     <StatusBlankReportUpdate />
 *     <StatusBlankReportUpdate />
 *   </div>
 * </StatusBlankPage>
 * ```
 */
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

/**
 * StatusBlankOverlay - Gradient overlay for page visualizations
 *
 * Provides a bottom-to-top gradient overlay that fades the visualization content
 * from transparent (top 40%) to background color (bottom), creating a subtle
 * depth effect. The overlay is absolutely positioned to cover the entire parent.
 *
 * This overlay helps create visual separation between the preview visualization
 * and any content that might be displayed on top of it (like call-to-action text).
 *
 * @example
 * ```tsx
 * <StatusBlankPage>
 *   <StatusBlankPageHeader />
 *   <StatusBlankMonitorUptime />
 *   <StatusBlankOverlay />
 * </StatusBlankPage>
 * ```
 */
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

// ============================================================================
// Composed Empty States
// ============================================================================

/**
 * StatusBlankEvents - Complete empty state for incident reports
 *
 * Displays a fully composed empty state with stacked StatusBlankReport
 * visualizations (three layers with varying scales and opacities) and
 * customizable title/description text. This creates an engaging empty state
 * that shows users what incident reports will look like.
 *
 * The visualization uses absolute positioning to create a layered card stack
 * effect with the front card at full opacity and back cards progressively
 * faded and scaled down.
 *
 * @param title - The empty state heading (default: "No reports found")
 * @param description - The empty state description (default: "No reports found for this status page.")
 *
 * @example
 * ```tsx
 * <StatusBlankEvents
 *   title="No incidents yet"
 *   description="Incident reports will appear here when created"
 * />
 * ```
 *
 * @see StatusBlankReport - For the underlying report visualization
 */
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

/**
 * StatusBlankMonitors - Complete empty state for monitors
 *
 * Displays a fully composed empty state with stacked StatusBlankMonitor
 * visualizations (three layers with varying scales and opacities) and
 * customizable title/description text. This creates an engaging empty state
 * that shows users what monitor displays will look like.
 *
 * The visualization uses absolute positioning to create a layered card stack
 * effect with the front card at full opacity and back cards progressively
 * faded and scaled down.
 *
 * @param title - The empty state heading (default: "No public monitors")
 * @param description - The empty state description (default: "No public monitors have been added to this page.")
 *
 * @example
 * ```tsx
 * <StatusBlankMonitors
 *   title="No monitors configured"
 *   description="Add monitors to start tracking uptime"
 * />
 * ```
 *
 * @see StatusBlankMonitor - For the underlying monitor visualization
 */
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
