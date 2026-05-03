"use client";

import { Link } from "@/components/common/link";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";

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
  StatusBlankAction,
  StatusBlankEvents,
  StatusBlankMonitors,
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
