import { cn } from "@openstatus/ui/lib/utils";
import { StatusIcon as UnifiedStatusIcon } from "@openstatus/ui/components/blocks/status-icon";

/**
 * Status - Root container component for status page layouts
 *
 * This component serves as the primary container for status page content, providing
 * consistent spacing and establishing the status type context via data attributes.
 * The status type controls the visual appearance of child StatusIcon components
 * through CSS data attribute selectors (group-data-[variant=...]).
 *
 * The component acts as both a CSS group and peer for advanced selector patterns,
 * enabling child components to style themselves based on the parent's status.
 *
 * @param variant - The status type that determines the overall status indicator appearance
 *
 * @example
 * ```tsx
 * <Status variant="success">
 *   <StatusHeader>
 *     <StatusBrand src="/logo.png" alt="Company" />
 *     <StatusTitle>System Status</StatusTitle>
 *   </StatusHeader>
 *   <StatusContent>
 *     {// Status components here}
 *   </StatusContent>
 * </Status>
 * ```
 *
 * @see StatusHeader - For header content with brand and title
 * @see StatusContent - For main status content area
 * @see StatusIcon - For status indicator icons that respond to variant
 */
export function Status({
  children,
  className,
  variant = "success",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "success" | "degraded" | "error" | "info";
}) {
  return (
    <div
      data-variant={variant}
      data-slot="status"
      className={cn("group peer flex flex-col gap-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}
Status.displayName = "Status";

/**
 * StatusBrand - Brand logo/image component for status page headers
 *
 * Displays a brand image (typically a company logo) with consistent sizing.
 * The default size is 32x32px (size-8), suitable for header placement.
 *
 * @param src - Image source URL
 * @param alt - Alternative text for the image (required for accessibility)
 *
 * @example
 * ```tsx
 * <StatusHeader>
 *   <StatusBrand src="/logo.png" alt="Company Name" />
 *   <StatusTitle>System Status</StatusTitle>
 * </StatusHeader>
 * ```
 *
 * @see StatusHeader - For positioning brand within header layout
 */
export function StatusBrand({
  src,
  alt,
  className,
  ...props
}: React.ComponentProps<"img">) {
  return (
    // biome-ignore lint/a11y/useAltText: <explanation>
    <img src={src} alt={alt} className={cn("size-8", className)} {...props} />
  );
}
StatusBrand.displayName = "StatusBrand";

/**
 * StatusHeader - Header container for status page branding and title
 *
 * Provides a container-query context (@container/status-header) for responsive
 * header layouts. Typically contains StatusBrand, StatusTitle, and StatusDescription
 * components arranged in a flexible layout.
 *
 * The container query context enables child components to respond to the header's
 * width rather than the viewport width, allowing for more modular layouts.
 *
 * @example
 * ```tsx
 * <StatusHeader>
 *   <div className="flex items-center gap-4">
 *     <StatusBrand src="/logo.png" alt="Company" />
 *     <div>
 *       <StatusTitle>System Status</StatusTitle>
 *       <StatusDescription>Current system health</StatusDescription>
 *     </div>
 *   </div>
 * </StatusHeader>
 * ```
 *
 * @see StatusBrand - For brand logo placement
 * @see StatusTitle - For page title
 * @see StatusDescription - For subtitle text
 */
export function StatusHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-header"
      className={cn("@container/status-header", className)}
      {...props}
    >
      {children}
    </div>
  );
}
StatusHeader.displayName = "StatusHeader";

/**
 * StatusTitle - Primary heading for status page
 *
 * Displays the main title with consistent typography (semibold, large text, tight leading).
 * Typically used within StatusHeader to show the page or organization name.
 *
 * The component uses semantic HTML div rather than h1 to allow flexible heading
 * levels based on page context. Apply appropriate heading tags as needed.
 *
 * @example
 * ```tsx
 * <StatusHeader>
 *   <StatusTitle>Acme Inc. Status</StatusTitle>
 *   <StatusDescription>Live system status and uptime</StatusDescription>
 * </StatusHeader>
 * ```
 *
 * @see StatusDescription - For subtitle text below the title
 */
export function StatusTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-title"
      className={cn(
        "font-semibold text-foreground text-lg leading-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
StatusTitle.displayName = "StatusTitle";

/**
 * StatusDescription - Descriptive subtitle or secondary text
 *
 * Displays muted secondary text, typically used for subtitles, additional context,
 * or descriptions. The text color is set to muted foreground for visual hierarchy.
 *
 * @example
 * ```tsx
 * <StatusHeader>
 *   <StatusTitle>System Status</StatusTitle>
 *   <StatusDescription>
 *     Real-time monitoring of all services
 *   </StatusDescription>
 * </StatusHeader>
 * ```
 *
 * @see StatusTitle - For primary heading text
 */
export function StatusDescription({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="status-description" className={cn("text-muted-foreground", className)}>
      {children}
    </div>
  );
}
StatusDescription.displayName = "StatusDescription";

/**
 * StatusContent - Main content area for status page components
 *
 * Provides a vertical flex container with consistent spacing (gap-3) for status
 * page content. This is typically used to stack StatusComponent, StatusBanner,
 * or other status-related components.
 *
 * @example
 * ```tsx
 * <Status variant="success">
 *   <StatusHeader>
 *     <StatusTitle>System Status</StatusTitle>
 *   </StatusHeader>
 *   <StatusContent>
 *     <StatusComponent variant="success">API</StatusComponent>
 *     <StatusComponent variant="success">Database</StatusComponent>
 *     <StatusComponent variant="degraded">CDN</StatusComponent>
 *   </StatusContent>
 * </Status>
 * ```
 *
 * @see Status - For root container
 * @see StatusComponent - For individual service status displays
 */
export function StatusContent({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="status-content" className={cn("flex flex-col gap-3", className)}>
      {children}
    </div>
  );
}
StatusContent.displayName = "StatusContent";

/**
 * StatusIcon - Status indicator icon wrapper for Status component context
 *
 * This component wraps the unified StatusIcon with variant="default", configuring
 * it to respond to the parent Status component's data-variant attribute.
 * The displayed icon automatically changes based on the status type:
 * - success: CheckIcon
 * - degraded: TriangleAlertIcon
 * - error: AlertCircleIcon
 * - info: WrenchIcon
 *
 * @example
 * ```tsx
 * <Status variant="success">
 *   <StatusHeader>
 *     <StatusIcon />
 *     <StatusTitle>All Systems Operational</StatusTitle>
 *   </StatusHeader>
 * </Status>
 * ```
 *
 * @see Status - For setting the variant context
 * @see StatusIcon from status-icon.tsx - For the underlying unified icon implementation
 */
export function StatusIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon variant="default" className={className} {...props} />
  );
}
StatusIcon.displayName = "StatusIcon";
