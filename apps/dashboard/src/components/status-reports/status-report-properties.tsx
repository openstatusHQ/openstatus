"use client";

import type { RouterOutputs } from "@openstatus/api";
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

/** Earliest update, else the row's creation. */
export function reportStartedAt(report: StatusReport): Date {
  const dates = report.updates.map((u) => u.date.getTime());
  if (dates.length) return new Date(Math.min(...dates));
  return report.createdAt ?? new Date(0);
}

/** Latest update once resolved; `null` while the report is open. */
export function reportEndedAt(report: StatusReport): Date | null {
  if (report.status !== "resolved") return null;
  const dates = report.updates.map((u) => u.date.getTime());
  if (!dates.length) return report.updatedAt ?? report.createdAt;
  return new Date(Math.max(...dates));
}

export function StatusReportProperties({ report }: { report: StatusReport }) {
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
            href={`/status-pages/${report.pageId}/status-reports`}
            className="truncate font-normal"
          >
            {report.page.title}
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
