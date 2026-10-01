"use client";

import type { RouterOutputs } from "@openstatus/api";
import { ArrowUpRight } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { statusVariants } from "@/data/status-report-updates.client";
import { useFeature } from "@/hooks/use-feature";
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
  const incidentsEnabled = useFeature("incident-management");
  const { data: incident } = useQuery({
    ...trpc.incident.forStatusReport.queryOptions({
      statusReportId: report.id,
    }),
    enabled: incidentsEnabled,
  });
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
          <Link
            href={publicUrl}
            className="inline-flex min-w-0 items-center gap-1 font-normal"
          >
            <span className="truncate">{report.page.title}</span>
            <ArrowUpRight className="size-3.5 shrink-0" />
          </Link>
        </PropertyValue>
      </Property>
      {incidentsEnabled ? (
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
      ) : null}
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
