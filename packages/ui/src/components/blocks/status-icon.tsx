import { cn } from "@openstatus/ui/lib/utils";
import {
  AlertCircleIcon,
  CheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import type { StatusType } from "@openstatus/ui/components/blocks/status.types";

interface StatusIconProps extends React.ComponentProps<"div"> {
  /**
   * The status type to display
   */
  status?: StatusType;
  /**
   * The variant determines the CSS selector pattern used for status-based styling
   * - "default": Uses group-data-[variant=...] (for Status component)
   * - "banner": Uses group-data-[status=...]/status-banner (for StatusBanner component)
   * - "component": Uses group-data-[variant=...]/component (for StatusComponent)
   */
  variant?: "default" | "banner" | "component";
}

/**
 * StatusIcon - A unified icon component for displaying status indicators
 *
 * This component renders the appropriate icon based on the status type:
 * - success: CheckIcon
 * - degraded: TriangleAlertIcon
 * - error: AlertCircleIcon
 * - info: WrenchIcon
 * - empty: No icon (muted background)
 *
 * @example
 * // In Status component context
 * <StatusIcon variant="default" />
 *
 * @example
 * // In StatusBanner context
 * <StatusIcon variant="banner" />
 *
 * @example
 * // In StatusComponent context
 * <StatusIcon variant="component" />
 */
export function StatusIcon({
  className,
  variant = "default",
  status,
  ...props
}: StatusIconProps) {
  // Define size classes based on variant
  const sizeClasses =
    variant === "component"
      ? "size-[12.5px] [&>svg]:size-[9px]"
      : "size-7 [&>svg]:size-4";

  // Define status-based classes based on variant
  const statusClasses = (() => {
    switch (variant) {
      case "banner":
        return [
          "group-data-[status=success]/status-banner:bg-success",
          "group-data-[status=degraded]/status-banner:bg-warning",
          "group-data-[status=error]/status-banner:bg-destructive",
          "group-data-[status=info]/status-banner:bg-info",
        ];
      case "component":
        return [
          "group-data-[variant=success]/component:bg-success",
          "group-data-[variant=degraded]/component:bg-warning",
          "group-data-[variant=error]/component:bg-destructive",
          "group-data-[variant=info]/component:bg-info",
        ];
      case "default":
      default:
        return [
          "group-data-[variant=success]:bg-success",
          "group-data-[variant=degraded]:bg-warning",
          "group-data-[variant=error]:bg-destructive",
          "group-data-[variant=info]:bg-info",
        ];
    }
  })();

  // Define icon visibility classes based on variant
  const iconVisibilityClasses = (() => {
    switch (variant) {
      case "banner":
        return {
          success: "group-data-[status=success]/status-banner:block",
          degraded: "group-data-[status=degraded]/status-banner:block",
          error: "group-data-[status=error]/status-banner:block",
          info: "group-data-[status=info]/status-banner:block",
        };
      case "component":
        return {
          success: "group-data-[variant=success]/component:block",
          degraded: "group-data-[variant=degraded]/component:block",
          error: "group-data-[variant=error]/component:block",
          info: "group-data-[variant=info]/component:block",
        };
      case "default":
      default:
        return {
          success: "group-data-[variant=success]:block",
          degraded: "group-data-[variant=degraded]:block",
          error: "group-data-[variant=error]:block",
          info: "group-data-[variant=info]:block",
        };
    }
  })();

  return (
    <div
      data-slot="status-icon"
      className={cn(
        "flex items-center justify-center rounded-full bg-muted text-background",
        sizeClasses,
        ...statusClasses,
        className,
      )}
      {...props}
    >
      <CheckIcon className={cn("hidden", iconVisibilityClasses.success)} />
      <TriangleAlertIcon
        className={cn("hidden", iconVisibilityClasses.degraded)}
      />
      <AlertCircleIcon className={cn("hidden", iconVisibilityClasses.error)} />
      <WrenchIcon className={cn("hidden", iconVisibilityClasses.info)} />
    </div>
  );
}
