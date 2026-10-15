"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  Property,
  PropertyLabel,
  PropertyLink,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { statusVariants } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;

export function StatusReportProperties({
  report,
  publicUrl,
}: {
  report: StatusReport;
  publicUrl: string;
}) {
  const trpc = useTRPC();
  const { data: incident } = useQuery(
    trpc.incident.forStatusReport.queryOptions({
      statusReportId: report.id,
    }),
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <PropertyList>
      <Property>
        <PropertyLabel>Status</PropertyLabel>
        <PropertyValue>
          <StatusDot variant={statusVariants[report.status]} />
          <span className="capitalize">{report.status}</span>
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Status page</PropertyLabel>
        <PropertyValue>
          <PropertyLink href={publicUrl}>{report.page.title}</PropertyLink>
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Incident</PropertyLabel>
        <PropertyValue>
          {incident ? (
            <Link
              href={`/incidents/${incident.id}`}
              className="truncate font-normal"
            >
              {incident.title}
            </Link>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Timezone</PropertyLabel>
        <PropertyValue>
          <span className="truncate" suppressHydrationWarning>
            {timezone}
          </span>
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
