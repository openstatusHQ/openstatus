"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";
import {
  StatusComponentIcon,
  StatusComponentStatus,
} from "@openstatus/ui/components/blocks/status-component";
import type { StatusType } from "@openstatus/ui/components/blocks/status.types";

/**
 * StatusComponentGroup - Collapsible group for organizing related monitors
 *
 * A collapsible container component for grouping related StatusComponent items,
 * displaying an aggregate status for the group. The component shows:
 * - Group title
 * - Aggregate status label (e.g., "Operational", "Degraded")
 * - Status icon with appropriate color
 * - Expandable/collapsible content area for grouped monitors
 *
 * **Key Features**:
 * - **Collapsible**: Click to expand/collapse grouped monitors
 * - **Hydration-Aware Animations**: Prevents layout shift on initial render by delaying
 *   animations until after mount (avoids animation flash when defaultOpen=true)
 * - **Aggregate Status**: Shows overall status for the entire group
 * - **Keyboard Accessible**: Full keyboard support via Radix UI Collapsible
 * - **Hover Effects**: Subtle border and background changes on hover/open
 *
 * The component uses a hydration-aware animation pattern: animations are disabled
 * on the server and first client render, then enabled after mount. This prevents
 * layout shifts when `defaultOpen={true}` is used.
 *
 * @param title - The group name/title
 * @param status - The aggregate status type for the group (controls icon color and status label)
 * @param defaultOpen - Whether the group starts expanded (default: false)
 * @param children - StatusComponent items or other content to display when expanded
 *
 * @example
 * // Basic collapsible group with multiple monitors
 * ```tsx
 * <StatusComponentGroup
 *   title="API Services"
 *   status="success"
 *   defaultOpen={false}
 * >
 *   <StatusComponent variant="success">
 *     <StatusComponentHeader>
 *       <StatusComponentHeaderLeft>
 *         <StatusComponentIcon />
 *         <StatusComponentTitle>REST API</StatusComponentTitle>
 *       </StatusComponentHeaderLeft>
 *     </StatusComponentHeader>
 *   </StatusComponent>
 *   <StatusComponent variant="success">
 *     <StatusComponentHeader>
 *       <StatusComponentHeaderLeft>
 *         <StatusComponentIcon />
 *         <StatusComponentTitle>GraphQL API</StatusComponentTitle>
 *       </StatusComponentHeaderLeft>
 *     </StatusComponentHeader>
 *   </StatusComponent>
 * </StatusComponentGroup>
 * ```
 *
 * @example
 * // Degraded group with mixed statuses
 * ```tsx
 * <StatusComponentGroup
 *   title="Database Cluster"
 *   status="degraded"
 *   defaultOpen={true}
 * >
 *   <StatusComponent variant="success">
 *     <StatusComponentHeader>
 *       <StatusComponentHeaderLeft>
 *         <StatusComponentIcon />
 *         <StatusComponentTitle>Primary DB</StatusComponentTitle>
 *       </StatusComponentHeaderLeft>
 *     </StatusComponentHeader>
 *   </StatusComponent>
 *   <StatusComponent variant="degraded">
 *     <StatusComponentHeader>
 *       <StatusComponentHeaderLeft>
 *         <StatusComponentIcon />
 *         <StatusComponentTitle>Replica DB</StatusComponentTitle>
 *       </StatusComponentHeaderLeft>
 *     </StatusComponentHeader>
 *   </StatusComponent>
 * </StatusComponentGroup>
 * ```
 *
 * @example
 * // Multiple groups for different service categories
 * ```tsx
 * <StatusContent>
 *   <StatusComponentGroup title="Core Services" status="success">
 *     // Core service monitors...
 *   </StatusComponentGroup>
 *   <StatusComponentGroup title="Third-Party APIs" status="degraded" defaultOpen>
 *     // Third-party monitors...
 *   </StatusComponentGroup>
 *   <StatusComponentGroup title="Internal Tools" status="success">
 *     // Internal tool monitors...
 *   </StatusComponentGroup>
 * </StatusContent>
 * ```
 *
 * @see StatusComponent - For individual monitor displays within the group
 * @see StatusComponentIcon - For the status icon displayed in the header
 * @see StatusComponentStatus - For the status label displayed in the header
 */
export function StatusComponentGroup({
  children,
  title,
  status,
  className,
  defaultOpen = false,
  ...props
}: React.ComponentProps<"div"> & {
  title: string;
  status?: Exclude<StatusType, "empty">;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div {...props}>
      <Collapsible
        defaultOpen={defaultOpen}
        data-slot="status-component-group"
        className={cn(
          "-mx-3",
          "rounded-lg border border-transparent bg-muted/50 hover:border-border/50 data-[state=open]:border-border/50 data-[state=open]:bg-muted/50",
          className,
        )}
      >
        <CollapsibleTrigger
          data-slot="status-component-group-trigger"
          className={cn(
            "group/component flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 font-medium font-mono",
            "cursor-pointer",
            className,
          )}
          data-variant={status}
          aria-label={`Toggle ${title} status details`}
        >
          {title}
          <div className="flex items-center gap-2">
            <StatusComponentStatus className="text-sm" />
            <StatusComponentIcon />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent
          data-slot="status-component-group-content"
          data-animate={mounted}
          className={cn(
            "flex flex-col gap-3 border-border/50 border-t px-3 py-2",
            "overflow-hidden",
            // REMINDER: otherwise, if defaultOpen is true, the animation will be triggered and we have a layout shift
            "data-[animate=true]:data-[state=closed]:animate-collapsible-up data-[animate=true]:data-[state=open]:animate-collapsible-down",
          )}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
StatusComponentGroup.displayName = "StatusComponentGroup";
