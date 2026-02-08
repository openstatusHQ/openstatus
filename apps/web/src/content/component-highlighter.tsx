"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Mapping of data-slot values to component names for display
 */
const DATA_SLOT_TO_COMPONENT: Record<string, string> = {
  // Layout components
  status: "Status",
  "status-header": "StatusHeader",
  "status-title": "StatusTitle",
  "status-description": "StatusDescription",
  "status-content": "StatusContent",

  // Banner components
  "status-banner": "StatusBanner",

  // Monitor components
  "status-component": "StatusComponent",
  "status-component-header": "StatusComponentHeader",
  "status-component-header-left": "StatusComponentHeaderLeft",
  "status-component-header-right": "StatusComponentHeaderRight",
  "status-component-body": "StatusComponentBody",
  "status-component-title": "StatusComponentTitle",
  "status-component-uptime": "StatusComponentUptime",
  "status-component-status": "StatusComponentStatus",
  "status-component-footer": "StatusComponentFooter",

  // Group component
  "status-component-group": "StatusComponentGroup",
  "status-component-group-trigger": "StatusComponentGroupTrigger",
  "status-component-group-content": "StatusComponentGroupContent",

  // Feed component
  "status-feed": "StatusFeed",

  // Event components
  "status-event-group": "StatusEventGroup",
  "status-event": "StatusEvent",
  "status-event-content": "StatusEventContent",
  "status-event-title": "StatusEventTitle",
  "status-event-title-check": "StatusEventTitleCheck",
  "status-event-affected": "StatusEventAffected",
  "status-event-affected-badge": "StatusEventAffectedBadge",
  "status-event-date": "StatusEventDate",
  "status-event-date-badge": "StatusEventDateBadge",
  "status-event-aside": "StatusEventAside",
  "status-event-timeline-report": "StatusEventTimelineReport",
  "status-event-timeline-report-update": "StatusEventTimelineReportUpdate",
  "status-event-timeline-maintenance": "StatusEventTimelineMaintenance",
  "status-event-timeline-title": "StatusEventTimelineTitle",
  "status-event-timeline-message": "StatusEventTimelineMessage",
  "status-event-timeline-dot": "StatusEventTimelineDot",
  "status-event-timeline-separator": "StatusEventTimelineSeparator",

  // Bar components
  "status-bar": "StatusBar",
  "status-bar-item": "StatusBarItem",
  "status-bar-card": "StatusBarCard",
  "status-bar-content": "StatusBarContent",
  "status-bar-event": "StatusBarEvent",

  // Utility components
  "status-timestamp": "StatusTimestamp",
  "status-timestamp-content": "StatusTimestampContent",
  "status-timestamp-row": "StatusTimestampRow",
};

/**
 * Find the nearest element with a data-slot attribute by traversing up the DOM tree
 */
function findNearestSlot(target: HTMLElement, root: HTMLElement) {
  let el: HTMLElement | null = target;
  while (el && el !== root) {
    const slot = el.dataset.slot;
    if (slot) {
      const componentName = DATA_SLOT_TO_COMPONENT[slot] || slot;
      return { element: el, name: componentName };
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * ComponentHighlighter
 *
 * Highlights OpenStatus components on hover by detecting their data-slot attributes.
 * Uses DOM inspection to find components, which works reliably at any nesting level.
 *
 * @param enabled - Control the highlighter state externally (optional)
 * @param children - The component tree to enable highlighting for
 *
 * @example
 * ```tsx
 * <ComponentHighlighter>
 *   <StatusPageExample />
 * </ComponentHighlighter>
 * ```
 */
export function ComponentHighlighter({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  shortcut?: boolean;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState<{
    rect: DOMRect;
    name: string;
  } | null>(null);

  // Find and highlight the nearest component with data-slot on mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || !rootRef.current) return;
      const match = findNearestSlot(e.target as HTMLElement, rootRef.current);
      if (match) {
        setHovered({
          rect: match.element.getBoundingClientRect(),
          name: match.name,
        });
      } else {
        setHovered(null);
      }
    },
    [enabled],
  );

  return (
    <div
      ref={rootRef}
      onMouseMove={enabled ? handleMouseMove : undefined}
      onMouseLeave={enabled ? () => setHovered(null) : undefined}
    >
      {children}
      {hovered && (
        <div
          className="pointer-events-none fixed z-[99999] bg-info/5 outline-2 outline-info transition-all duration-100 ease-in-out"
          style={{
            top: hovered.rect.top,
            left: hovered.rect.left,
            width: hovered.rect.width,
            height: hovered.rect.height,
          }}
        >
          <span className="-left-px -top-px absolute whitespace-nowrap bg-info px-2 py-0.5 font-mono font-semibold text-[11px] text-white leading-tight">
            {hovered.name}
          </span>
        </div>
      )}
    </div>
  );
}
