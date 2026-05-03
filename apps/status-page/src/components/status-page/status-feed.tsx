"use client";

import { Link } from "@/components/common/link";
import { ProcessMessage } from "@/components/content/process-message";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { StatusBlankAction } from "@openstatus/ui/components/blocks/status-blank";
import { StatusFeed as BlockStatusFeed } from "@openstatus/ui/components/blocks/status-feed";
import { useExtracted } from "next-intl";
import { StatusBlankLink } from "./status-blank";

const renderMarkdownMessage = (message: string) => (
  <ProcessMessage value={message} />
);

export function StatusFeed({
  statusReports = [],
  maintenances = [],
  ...props
}: Omit<
  React.ComponentProps<typeof BlockStatusFeed>,
  | "renderEvent"
  | "renderReportMessage"
  | "renderMaintenanceMessage"
  | "footer"
  | "emptyAction"
>) {
  const prefix = usePathnamePrefix();
  const t = useExtracted();
  const eventsHref = `${prefix ? `/${prefix}` : ""}/events`;

  return (
    <BlockStatusFeed
      statusReports={statusReports}
      maintenances={maintenances}
      renderReportMessage={renderMarkdownMessage}
      renderMaintenanceMessage={renderMarkdownMessage}
      renderEvent={(event, content) => (
        <Link
          variant="unstyled"
          href={`${prefix ? `/${prefix}` : ""}/events/${event.type}/${event.data.id}`}
          className="rounded-lg"
        >
          {content}
        </Link>
      )}
      emptyAction={
        <StatusBlankAction>
          <Link href={eventsHref}>{t("View events history")}</Link>
        </StatusBlankAction>
      }
      footer={
        <StatusBlankLink className="mx-auto mt-4" href={eventsHref}>
          {t("View events history")}
        </StatusBlankLink>
      }
      {...props}
    />
  );
}
