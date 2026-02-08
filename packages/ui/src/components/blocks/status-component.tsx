"use client";

import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useMediaQuery } from "@openstatus/ui/hooks/use-media-query";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { InfoIcon } from "lucide-react";
import { useState } from "react";
import { StatusIcon as UnifiedStatusIcon } from "@openstatus/ui/components/blocks/status-icon";
import type {
  StatusBarData,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";
import { systemStatusLabels } from "@openstatus/ui/components/blocks/status.utils";

// ============================================================================
// Layout Components
// ============================================================================

interface StatusComponentProps extends React.ComponentProps<"div"> {
  variant: Exclude<StatusType, "empty">;
}

/**
 * StatusComponent - Root container for individual monitor/service status displays
 *
 * This component serves as the main container for displaying a single monitor or
 * service status. It establishes the status type context via data-variant attribute,
 * which child components (like StatusComponentIcon and StatusComponentStatus) use
 * to display the appropriate colors and icons.
 *
 * The component acts as a CSS group (/component) for advanced selector patterns,
 * enabling child components to style themselves based on the parent's variant.
 *
 * @param variant - The status type (success, degraded, error, or info)
 *
 * @example
 * ```tsx
 * <StatusComponent variant="success">
 *   <StatusComponentHeader>
 *     <StatusComponentHeaderLeft>
 *       <StatusComponentIcon />
 *       <StatusComponentTitle>API Server</StatusComponentTitle>
 *       <StatusComponentDescription>Main API endpoint</StatusComponentDescription>
 *     </StatusComponentHeaderLeft>
 *     <StatusComponentHeaderRight>
 *       <StatusComponentUptime>99.9%</StatusComponentUptime>
 *       <StatusComponentStatus />
 *     </StatusComponentHeaderRight>
 *   </StatusComponentHeader>
 *   <StatusComponentBody>
 *     <StatusBar data={uptimeData} />
 *   </StatusComponentBody>
 * </StatusComponent>
 * ```
 *
 * @see StatusComponentHeader - For header layout
 * @see StatusComponentBody - For content area
 * @see StatusComponentIcon - For status indicator icon
 * @see StatusComponentStatus - For status label
 */
export function StatusComponent({
  variant,
  className,
  children,
  ...props
}: StatusComponentProps) {
  return (
    <div
      data-slot="status-component"
      data-variant={variant}
      className={cn("group/component space-y-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponent.displayName = "StatusComponent";

// ============================================================================
// Header Components
// ============================================================================

/**
 * StatusComponentHeader - Header container for monitor status information
 *
 * Provides a flex container with space-between alignment for the monitor header,
 * typically containing title/description on the left and status/uptime on the right.
 *
 * @example
 * ```tsx
 * <StatusComponentHeader>
 *   <StatusComponentHeaderLeft>
 *     <StatusComponentIcon />
 *     <StatusComponentTitle>Database</StatusComponentTitle>
 *   </StatusComponentHeaderLeft>
 *   <StatusComponentHeaderRight>
 *     <StatusComponentUptime>100%</StatusComponentUptime>
 *   </StatusComponentHeaderRight>
 * </StatusComponentHeader>
 * ```
 *
 * @see StatusComponentHeaderLeft - For left-aligned content
 * @see StatusComponentHeaderRight - For right-aligned content
 */
export function StatusComponentHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-header"
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponentHeader.displayName = "StatusComponentHeader";

/**
 * StatusComponentHeaderLeft - Left-aligned header content container
 *
 * Provides a flex container with gap-2 spacing for left-aligned header elements,
 * typically containing the status icon, title, and optional description icon.
 *
 * @example
 * ```tsx
 * <StatusComponentHeaderLeft>
 *   <StatusComponentIcon />
 *   <StatusComponentTitle>API Gateway</StatusComponentTitle>
 *   <StatusComponentDescription>
 *     Handles all incoming requests
 *   </StatusComponentDescription>
 * </StatusComponentHeaderLeft>
 * ```
 *
 * @see StatusComponentIcon - For status indicator
 * @see StatusComponentTitle - For service name
 * @see StatusComponentDescription - For info tooltip
 */
export function StatusComponentHeaderLeft({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-header-left"
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponentHeaderLeft.displayName = "StatusComponentHeaderLeft";

/**
 * StatusComponentHeaderRight - Right-aligned header content container
 *
 * Provides a flex container with gap-3 spacing for right-aligned header elements,
 * typically containing uptime percentage and status label.
 *
 * @example
 * ```tsx
 * <StatusComponentHeaderRight>
 *   <StatusComponentUptime>99.95%</StatusComponentUptime>
 *   <StatusComponentStatus />
 * </StatusComponentHeaderRight>
 * ```
 *
 * @see StatusComponentUptime - For uptime percentage display
 * @see StatusComponentStatus - For status label
 */
export function StatusComponentHeaderRight({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-header-right"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponentHeaderRight.displayName = "StatusComponentHeaderRight";

// ============================================================================
// Content Components
// ============================================================================

/**
 * StatusComponentBody - Main content area for monitor visualizations
 *
 * Provides vertical spacing (space-y-2) for stacking content like status bars,
 * charts, or other status visualizations within the component.
 *
 * @example
 * ```tsx
 * <StatusComponentBody>
 *   <StatusBar data={uptimeData} />
 *   <StatusComponentFooter data={uptimeData} />
 * </StatusComponentBody>
 * ```
 *
 * @see StatusBar - For uptime visualization bars
 * @see StatusComponentFooter - For footer with date range
 */
export function StatusComponentBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-body"
      className={cn("space-y-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponentBody.displayName = "StatusComponentBody";

// ============================================================================
// Display Components
// ============================================================================

/**
 * StatusComponentTitle - Monitor or service name display
 *
 * Displays the monitor/service name in monospace font with truncation for long names.
 * The text is medium weight and uses a base font size.
 *
 * @example
 * ```tsx
 * <StatusComponentTitle>Production API</StatusComponentTitle>
 * ```
 *
 * @example
 * ```tsx
 * <StatusComponentTitle>
 *   {monitor.name}
 * </StatusComponentTitle>
 * ```
 */
export function StatusComponentTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-title"
      className={cn(
        "truncate font-medium font-mono text-base text-foreground leading-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponentTitle.displayName = "StatusComponentTitle";

/**
 * StatusComponentDescription - Info icon with tooltip for additional details
 *
 * Displays an info icon that shows a tooltip on hover (or tap on touch devices)
 * with additional description text. Returns null if no children are provided,
 * allowing for conditional rendering.
 *
 * Touch device support is built-in, toggling the tooltip on tap instead of
 * requiring hover.
 *
 * @param children - The description text to show in the tooltip
 *
 * @example
 * ```tsx
 * <StatusComponentDescription>
 *   This service handles user authentication and authorization
 * </StatusComponentDescription>
 * ```
 *
 * @example
 * ```tsx
 * // Conditionally rendered - returns null if no description
 * <StatusComponentDescription>
 *   {monitor.description}
 * </StatusComponentDescription>
 * ```
 */
export function StatusComponentDescription({
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof TooltipTrigger>) {
  const isTouch = useMediaQuery("(hover: none)");
  const [open, setOpen] = useState(false);

  if (!children) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          onClick={(e) => {
            if (isTouch) setOpen((prev) => !prev);
            onClick?.(e);
          }}
          className="rounded-full"
          {...props}
        >
          <InfoIcon className="size-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{children}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
StatusComponentDescription.displayName = "StatusComponentDescription";

/**
 * StatusComponentIcon - Status indicator icon for component context
 *
 * This component wraps the unified StatusIcon with variant="component", configuring
 * it to respond to the parent StatusComponent's data-variant attribute.
 * The displayed icon and color automatically change based on the status type:
 * - success: Green check icon
 * - degraded: Yellow warning triangle
 * - error: Red alert circle
 * - info: Blue wrench icon
 *
 * The icon is smaller (size-[12.5px]) than other variants, optimized for inline
 * display next to monitor titles.
 *
 * @example
 * ```tsx
 * <StatusComponent variant="degraded">
 *   <StatusComponentHeaderLeft>
 *     <StatusComponentIcon />
 *     <StatusComponentTitle>CDN</StatusComponentTitle>
 *   </StatusComponentHeaderLeft>
 * </StatusComponent>
 * ```
 *
 * @see StatusComponent - For setting the variant context
 * @see StatusIcon from status-icon.tsx - For the underlying unified icon implementation
 */
export function StatusComponentIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon variant="component" className={className} {...props} />
  );
}
StatusComponentIcon.displayName = "StatusComponentIcon";

/**
 * StatusComponentFooter - Date range footer for status visualizations
 *
 * Displays a date range footer showing the time span of the displayed data,
 * with the start date on the left (formatted as relative time like "45 days ago")
 * and "today" on the right. Shows a skeleton loader when data is loading.
 *
 * If no data is available, displays a dash (-) on the left side.
 *
 * @param data - Array of status bar data points (uses first item's date for start)
 * @param isLoading - Whether the data is currently loading
 *
 * @example
 * ```tsx
 * <StatusComponentBody>
 *   <StatusBar data={uptimeData} />
 *   <StatusComponentFooter data={uptimeData} isLoading={false} />
 * </StatusComponentBody>
 * ```
 *
 * @example
 * ```tsx
 * // With loading state
 * <StatusComponentFooter data={[]} isLoading={true} />
 * ```
 *
 * @see StatusBar - For the visualization that this footer describes
 */
export function StatusComponentFooter({
  data,
  isLoading,
}: {
  data: StatusBarData[];
  isLoading?: boolean;
}) {
  return (
    <div
      data-slot="status-component-footer"
      className="flex flex-row items-center justify-between font-mono text-muted-foreground text-xs leading-none"
    >
      <div>
        {isLoading ? (
          <Skeleton className="h-3 w-18" />
        ) : data.length > 0 ? (
          formatDistanceToNowStrict(new Date(data[0].day), {
            unit: "day",
            addSuffix: true,
          })
        ) : (
          "-"
        )}
      </div>
      <div>today</div>
    </div>
  );
}
StatusComponentFooter.displayName = "StatusComponentFooter";

/**
 * StatusComponentUptime - Uptime percentage display
 *
 * Displays the uptime percentage in monospace font with slightly muted foreground
 * color. Typically shows values like "99.9%" or "100%".
 *
 * @example
 * ```tsx
 * <StatusComponentUptime>99.95%</StatusComponentUptime>
 * ```
 *
 * @example
 * ```tsx
 * <StatusComponentUptime>
 *   {calculateUptime(data)}%
 * </StatusComponentUptime>
 * ```
 *
 * @see StatusComponentUptimeSkeleton - For loading state
 */
export function StatusComponentUptime({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-uptime"
      className={cn(
        "font-mono text-foreground/80 text-sm leading-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
StatusComponentUptime.displayName = "StatusComponentUptime";

/**
 * StatusComponentUptimeSkeleton - Loading skeleton for uptime percentage
 *
 * Displays a skeleton loader matching the size of the uptime percentage display
 * (h-4 w-16), used while uptime data is being fetched.
 *
 * @example
 * ```tsx
 * <StatusComponentHeaderRight>
 *   {isLoading ? (
 *     <StatusComponentUptimeSkeleton />
 *   ) : (
 *     <StatusComponentUptime>{uptime}%</StatusComponentUptime>
 *   )}
 * </StatusComponentHeaderRight>
 * ```
 *
 * @see StatusComponentUptime - For the actual uptime display
 */
export function StatusComponentUptimeSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-4 w-16", className)} {...props} />;
}

/**
 * StatusComponentStatus - Automatic status label display
 *
 * Displays a status label that automatically shows the appropriate text and color
 * based on the parent StatusComponent's variant. The component uses CSS data
 * attribute selectors to show only the relevant status label:
 * - success: "Operational" (green)
 * - degraded: "Degraded" (yellow)
 * - error: "Outage" (red)
 * - info: "Maintenance" (blue)
 *
 * The labels are sourced from systemStatusLabels.short for consistent messaging
 * across the application.
 *
 * @example
 * ```tsx
 * <StatusComponent variant="success">
 *   <StatusComponentHeaderRight>
 *     <StatusComponentStatus />
 *     // Displays "Operational" in green
 *   </StatusComponentHeaderRight>
 * </StatusComponent>
 * ```
 *
 * @example
 * ```tsx
 * <StatusComponent variant="degraded">
 *   <StatusComponentHeaderRight>
 *     <StatusComponentStatus />
 *     // Displays "Degraded" in yellow
 *   </StatusComponentHeaderRight>
 * </StatusComponent>
 * ```
 *
 * @see StatusComponent - For setting the variant that controls the displayed status
 * @see systemStatusLabels - For the status label text definitions
 */
export function StatusComponentStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-component-status"
      className={cn(
        "font-mono text-sm leading-none",
        "group-data-[variant=success]/component:text-success",
        "group-data-[variant=degraded]/component:text-warning",
        "group-data-[variant=error]/component:text-destructive",
        "group-data-[variant=info]/component:text-info",
        className,
      )}
      {...props}
    >
      <span className="hidden group-data-[variant=success]/component:block">
        {systemStatusLabels.success.short}
      </span>
      <span className="hidden group-data-[variant=degraded]/component:block">
        {systemStatusLabels.degraded.short}
      </span>
      <span className="hidden group-data-[variant=error]/component:block">
        {systemStatusLabels.error.short}
      </span>
      <span className="hidden group-data-[variant=info]/component:block">
        {systemStatusLabels.info.short}
      </span>
    </div>
  );
}
StatusComponentStatus.displayName = "StatusComponentStatus";
