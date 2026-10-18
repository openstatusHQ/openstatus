"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import {
  EventListActions,
  EventListContent,
  EventListDescription,
  EventListItem,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { StatusReportRowActions } from "@/components/data-table/status-reports/data-table-row-actions";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { listNames, pluralize } from "@/data/event-list.client";
import {
  reportResolvedAt,
  reportStartedAt,
  worstReportImpact,
} from "@/data/status-reports.client";

import {
  StatusReportImpactBadge,
  StatusReportStatusBadge,
} from "./status-report-badge";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

/** `type` prefixes the sentence with "Status report", for lists that mix event kinds. */
export function StatusReportRow({
  report,
  type = false,
}: {
  report: StatusReport;
  type?: boolean;
}) {
  const startedAt = reportStartedAt(report);
  const resolvedAt = reportResolvedAt(report);
  const impact = worstReportImpact(report);
  const open = report.status !== "resolved";
  return (
    <EventListItem>
      <EventListContent>
        <EventListTitle asChild>
          <NextLink
            href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
          >
            {report.title}
          </NextLink>
        </EventListTitle>
        <EventListDescription>
          {type ? <span>Status report</span> : null}
          {open ? (
            <StatusReportStatusBadge status={report.status} plain />
          ) : null}
          {impact === undefined ? (
            <span>No impact</span>
          ) : (
            <StatusReportImpactBadge impact={impact} plain />
          )}
          {report.pageComponents.length > 0 ? (
            <span className="min-w-0 truncate">
              {listNames(report.pageComponents.map((c) => c.name))}
            </span>
          ) : null}
          <span>{pluralize(report.updates.length, "update")}</span>
          {resolvedAt && startedAt.getTime() > 0 ? (
            <span>lasted {formatDistanceStrict(startedAt, resolvedAt)}</span>
          ) : null}
        </EventListDescription>
      </EventListContent>
      <EventListTime date={startedAt} />
      <EventListActions>
        {open ? (
          <FormSheetStatusReportUpdateCreate report={report}>
            <Button variant="outline" size="sm" className="h-7">
              Add update
            </Button>
          </FormSheetStatusReportUpdateCreate>
        ) : null}
        <StatusReportRowActions report={report} />
      </EventListActions>
    </EventListItem>
  );
}
