import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { systemStatusLabels } from "@openstatus/ui/components/blocks/status.utils";
import { StatusIcon as UnifiedStatusIcon } from "@openstatus/ui/components/blocks/status-icon";
import type { StatusType } from "@openstatus/ui/components/blocks/status.types";
import { StatusTimestamp } from "@openstatus/ui/components/blocks/status-timestamp";

/**
 * StatusBanner - Complete banner component with integrated icon, message, and timestamp
 *
 * A fully composed banner component that displays a prominent status message with:
 * - Status-colored icon on the left
 * - Automatic status message (e.g., "All Systems Operational")
 * - Current timestamp on the right
 *
 * The banner automatically styles itself based on the status type with colored
 * backgrounds and borders. This is the simplest way to display a status banner
 * when you don't need custom content.
 *
 * For custom banner content, use StatusBannerContainer with manual composition.
 *
 * @param status - The status type that determines appearance and message
 *
 * @example
 * ```tsx
 * <StatusBanner status="success" />
 * // Displays: [✓ icon] All Systems Operational | Jan 15, 2024 10:30 (UTC)
 * ```
 *
 * @example
 * ```tsx
 * <StatusBanner status="degraded" />
 * // Displays: [⚠ icon] Degraded Performance | Jan 15, 2024 10:30 (UTC)
 * ```
 *
 * @see StatusBannerContainer - For custom banner composition
 * @see StatusBannerMessage - For the automatic status message
 * @see StatusTimestamp - For the timestamp display
 */
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

/**
 * StatusBannerContainer - Base container for status banner composition
 *
 * Provides a rounded, bordered container with status-based styling via data
 * attributes. The container acts as a CSS group (/status-banner) enabling child
 * components to style themselves based on the status type.
 *
 * Background colors automatically adjust for light/dark mode:
 * - success: Green tint (bg-success/5 light, bg-success/10 dark)
 * - degraded: Yellow tint (bg-warning/5 light, bg-warning/10 dark)
 * - error: Red tint (bg-destructive/5 light, bg-destructive/10 dark)
 * - info: Blue tint (bg-info/5 light, bg-info/10 dark)
 *
 * @param status - The status type for styling
 *
 * @example
 * ```tsx
 * <StatusBannerContainer status="error">
 *   <StatusBannerTitle>Active Incident</StatusBannerTitle>
 *   <StatusBannerContent>
 *     <p>We are experiencing issues with the API.</p>
 *   </StatusBannerContent>
 * </StatusBannerContainer>
 * ```
 *
 * @see StatusBanner - For a pre-composed banner with icon/message/timestamp
 * @see StatusBannerTitle - For colored title bar
 * @see StatusBannerContent - For main content area
 */
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

/**
 * StatusBannerMessage - Automatic status message display
 *
 * Displays a status message that automatically shows the appropriate text based
 * on the parent StatusBannerContainer's status. Uses CSS data attribute selectors
 * to show only the relevant message:
 * - success: "All Systems Operational"
 * - degraded: "Degraded Performance"
 * - error: "Partial Outage"
 * - info: "Maintenance"
 *
 * The messages are sourced from systemStatusLabels.long for consistent messaging.
 *
 * @example
 * ```tsx
 * <StatusBannerContainer status="success">
 *   <StatusBannerMessage className="text-xl font-semibold" />
 *   // Displays "All Systems Operational"
 * </StatusBannerContainer>
 * ```
 *
 * @see StatusBannerContainer - For setting the status context
 * @see systemStatusLabels - For the message text definitions
 */
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

/**
 * StatusBannerTitle - Colored title bar for banner sections
 *
 * Displays a title with a solid status-colored background and light text color.
 * The background color automatically adjusts based on the parent StatusBannerContainer's
 * status type:
 * - success: Green background
 * - degraded: Yellow background
 * - error: Red background
 * - info: Blue background
 *
 * Typically used to create distinct sections within a banner or to highlight
 * important information.
 *
 * @example
 * ```tsx
 * <StatusBannerContainer status="error">
 *   <StatusBannerTitle>Ongoing Incident</StatusBannerTitle>
 *   <StatusBannerContent>
 *     <p>Details about the incident...</p>
 *   </StatusBannerContent>
 * </StatusBannerContainer>
 * ```
 *
 * @see StatusBannerContainer - For setting the status context
 * @see StatusBannerContent - For main content below the title
 */
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

/**
 * StatusBannerContent - Main content area for banner messages
 *
 * Provides consistent padding and spacing (gap-2) for banner content. Used to
 * display detailed messages, updates, or other information within a status banner.
 *
 * The padding is responsive: px-3 py-2 on mobile, px-4 py-3 on larger screens.
 *
 * @example
 * ```tsx
 * <StatusBannerContainer status="info">
 *   <StatusBannerTitle>Scheduled Maintenance</StatusBannerTitle>
 *   <StatusBannerContent>
 *     <p>We will be performing maintenance on Jan 20 from 2-4 AM UTC.</p>
 *     <p>Some services may be temporarily unavailable.</p>
 *   </StatusBannerContent>
 * </StatusBannerContainer>
 * ```
 *
 * @see StatusBannerContainer - For the container
 * @see StatusBannerTitle - For optional title bar above content
 */
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

/**
 * StatusBannerIcon - Status indicator icon for banner context
 *
 * This component wraps the unified StatusIcon with variant="banner", configuring
 * it to respond to the parent StatusBannerContainer's data-status attribute.
 * The displayed icon automatically changes based on the status type:
 * - success: CheckIcon
 * - degraded: TriangleAlertIcon
 * - error: AlertCircleIcon
 * - info: WrenchIcon
 *
 * @example
 * ```tsx
 * <StatusBannerContainer status="degraded">
 *   <div className="flex items-center gap-3">
 *     <StatusBannerIcon />
 *     <StatusBannerMessage />
 *   </div>
 * </StatusBannerContainer>
 * ```
 *
 * @see StatusBannerContainer - For setting the status context
 * @see StatusIcon from status-icon.tsx - For the underlying unified icon implementation
 */
export function StatusBannerIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon variant="banner" className={className} {...props} />
  );
}

// ============================================================================
// Tab Components
// ============================================================================

/**
 * StatusBannerTabs - Tab container for multi-section status banners
 *
 * Provides a tabbed interface for status banners, allowing multiple views or
 * sections within a single banner. The tabs container automatically applies
 * status-based background colors matching the banner theme.
 *
 * Built on Radix UI Tabs with status-aware styling.
 *
 * @param status - The status type for background color theming
 *
 * @example
 * ```tsx
 * <StatusBannerTabs status="degraded" defaultValue="impact">
 *   <StatusBannerTabsList>
 *     <StatusBannerTabsTrigger value="impact" status="degraded">
 *       Impact
 *     </StatusBannerTabsTrigger>
 *     <StatusBannerTabsTrigger value="updates" status="degraded">
 *       Updates
 *     </StatusBannerTabsTrigger>
 *   </StatusBannerTabsList>
 *   <StatusBannerTabsContent value="impact">
 *     <StatusBannerContent>
 *       <p>Services affected by this incident...</p>
 *     </StatusBannerContent>
 *   </StatusBannerTabsContent>
 *   <StatusBannerTabsContent value="updates">
 *     <StatusBannerContent>
 *       <p>Latest updates on resolution...</p>
 *     </StatusBannerContent>
 *   </StatusBannerTabsContent>
 * </StatusBannerTabs>
 * ```
 *
 * @see StatusBannerTabsList - For the tab navigation
 * @see StatusBannerTabsTrigger - For individual tab buttons
 * @see StatusBannerTabsContent - For tab panel content
 */
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

/**
 * StatusBannerTabsList - Tab navigation container
 *
 * Wraps the tab triggers in a scrollable container with rounded top corners.
 * The container automatically handles overflow with horizontal scrolling on
 * smaller screens.
 *
 * @example
 * ```tsx
 * <StatusBannerTabsList>
 *   <StatusBannerTabsTrigger value="overview" status="success">
 *     Overview
 *   </StatusBannerTabsTrigger>
 *   <StatusBannerTabsTrigger value="details" status="success">
 *     Details
 *   </StatusBannerTabsTrigger>
 * </StatusBannerTabsList>
 * ```
 *
 * @see StatusBannerTabsTrigger - For individual tab buttons
 */
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

/**
 * StatusBannerTabsTrigger - Individual tab button
 *
 * Displays a single tab trigger button with status-based coloring. The button
 * shows:
 * - Inactive state: 50% opacity status color background
 * - Active state: Full status color background with light text
 *
 * The status parameter should match the parent StatusBannerTabs status for
 * consistent theming.
 *
 * @param status - The status type for color theming
 * @param value - The tab value (for Radix UI Tabs)
 *
 * @example
 * ```tsx
 * <StatusBannerTabsList>
 *   <StatusBannerTabsTrigger value="affected" status="error">
 *     Affected Services
 *   </StatusBannerTabsTrigger>
 *   <StatusBannerTabsTrigger value="timeline" status="error">
 *     Timeline
 *   </StatusBannerTabsTrigger>
 * </StatusBannerTabsList>
 * ```
 *
 * @see StatusBannerTabsList - For the container
 * @see StatusBannerTabsContent - For the corresponding content panels
 */
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

/**
 * StatusBannerTabsContent - Tab panel content container
 *
 * Wraps the content for a single tab panel. The component includes negative
 * horizontal margin (-mx-3) to align edge-to-edge with the banner container
 * when used with StatusBannerContent.
 *
 * @param value - The tab value (must match a StatusBannerTabsTrigger value)
 *
 * @example
 * ```tsx
 * <StatusBannerTabsContent value="updates">
 *   <StatusBannerContent>
 *     <h3>Latest Update</h3>
 *     <p>We have identified the issue and are working on a fix...</p>
 *   </StatusBannerContent>
 * </StatusBannerTabsContent>
 * ```
 *
 * @see StatusBannerTabsTrigger - For the tab button that activates this content
 * @see StatusBannerContent - Typically used as a child for proper padding
 */
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
