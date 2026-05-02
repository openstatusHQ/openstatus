"use client";

import { Link } from "@/components/common/link";
import {
  StatusBlankEvents as BlockStatusBlankEvents,
  StatusBlankMonitors as BlockStatusBlankMonitors,
} from "@openstatus/ui/components/blocks/status-blank";
import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";

// Layout / chrome primitives — kept here for legacy non-block blank states.
// Block consumers should prefer `StatusBlankEvents`/`StatusBlankMonitors` below
// (which delegate to the block primitives + supply the Link-wrapped action slot).

export {
  StatusBlankContainer,
  StatusBlankTitle,
  StatusBlankDescription,
  StatusBlankContent,
  StatusBlankReport,
  StatusBlankMonitor,
  StatusBlankPage,
  StatusBlankPageHeader,
  StatusBlankMonitorUptime,
  StatusBlankReportUpdate,
  StatusBlankOverlay,
} from "@openstatus/ui/components/blocks/status-blank";

/**
 * StatusBlankLink — outlined Button-as-Link CTA for empty states.
 * Kept as the canonical look used outside `StatusBlankEvents`/`Monitors`.
 */
export function StatusBlankLink({
  children,
  className,
  href,
  ...props
}: React.ComponentProps<typeof Button> & { href: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("text-foreground", className)}
      asChild
      {...props}
    >
      <Link variant="unstyled" href={href}>
        {children}
      </Link>
    </Button>
  );
}

/**
 * StatusBlankEvents — wrapper that uses the block primitive and provides
 * translated title/description from the i18n provider.
 */
export function StatusBlankEvents({
  title,
  description,
  action,
  ...props
}: React.ComponentProps<typeof BlockStatusBlankEvents>) {
  const labels = useStatusBlocksLabels();
  return (
    <BlockStatusBlankEvents
      title={title ?? labels.noReports}
      description={description ?? labels.noReportsDescription}
      action={action}
      {...props}
    />
  );
}

export function StatusBlankMonitors({
  title,
  description,
  action,
  ...props
}: React.ComponentProps<typeof BlockStatusBlankMonitors>) {
  const labels = useStatusBlocksLabels();
  return (
    <BlockStatusBlankMonitors
      title={title ?? labels.noPublicMonitors}
      description={description ?? labels.noPublicMonitorsDescription}
      action={action}
      {...props}
    />
  );
}
