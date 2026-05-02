"use client";

import { ProcessMessage } from "@/components/content/process-message";
import {
  StatusEventTimelineMaintenance as BlockStatusEventTimelineMaintenance,
  StatusEventTimelineReport as BlockStatusEventTimelineReport,
  StatusEventTimelineReportUpdate as BlockStatusEventTimelineReportUpdate,
} from "@openstatus/ui/components/blocks/status-events";

// Re-export pass-through primitives that don't need glue.
export {
  StatusEvent,
  StatusEventGroup,
  StatusEventContent,
  StatusEventTitle,
  StatusEventTitleCheck,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventDate,
  StatusEventAside,
  StatusEventTimelineTitle,
  StatusEventTimelineMessage,
  StatusEventTimelineDot,
  StatusEventTimelineSeparator,
} from "@openstatus/ui/components/blocks/status-events";

const renderMarkdownMessage = (message: string) => (
  <ProcessMessage value={message} />
);

/**
 * StatusEventTimelineReport — wrapper that pipes user-authored markdown
 * through `<ProcessMessage>` so report messages render with formatting.
 */
export function StatusEventTimelineReport(
  props: Omit<
    React.ComponentProps<typeof BlockStatusEventTimelineReport>,
    "renderMessage"
  >,
) {
  return (
    <BlockStatusEventTimelineReport
      renderMessage={renderMarkdownMessage}
      {...props}
    />
  );
}

/**
 * StatusEventTimelineMaintenance — wrapper that pipes user-authored markdown
 * through `<ProcessMessage>` so maintenance messages render with formatting.
 */
export function StatusEventTimelineMaintenance(
  props: Omit<
    React.ComponentProps<typeof BlockStatusEventTimelineMaintenance>,
    "renderMessage"
  >,
) {
  return (
    <BlockStatusEventTimelineMaintenance
      renderMessage={renderMarkdownMessage}
      {...props}
    />
  );
}

/**
 * StatusEventTimelineReportUpdate — wrapper for single-update rendering
 * (used by the banner tabs to show only the latest update). Pipes markdown
 * through `<ProcessMessage>`.
 */
export function StatusEventTimelineReportUpdate(
  props: Omit<
    React.ComponentProps<typeof BlockStatusEventTimelineReportUpdate>,
    "renderMessage"
  >,
) {
  return (
    <BlockStatusEventTimelineReportUpdate
      renderMessage={renderMarkdownMessage}
      {...props}
    />
  );
}
