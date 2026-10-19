"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import NextLink from "next/link";

import { SeverityBars } from "@/components/common/severity-bars";
import { TypeTag } from "@/components/common/type-tag";
import {
  EventListActions,
  EventListContent,
  EventListDescription,
  EventListDetail,
  EventListItem,
  EventListMedia,
  EventListMeta,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import {
  formatDurationShort,
  formatEventDate,
  pluralize,
} from "@/data/event-list.client";
import {
  impactDisplay,
  statusVariants,
} from "@/data/status-report-updates.client";
import {
  reportResolvedAt,
  reportStartedAt,
  worstReportImpact,
} from "@/data/status-reports.client";

import { StatusReportStatusBadge } from "./status-report-badge";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

const impactLevel = {
  operational: 0,
  degraded_performance: 1,
  partial_outage: 2,
  major_outage: 3,
} as const;

/**
 * `type` is for lists that mix event kinds: a type tag leads and the
 * sentence is the state and the date.
 */
export function StatusReportRow({
  report,
  type = false,
}: {
  report: StatusReport;
  type?: boolean;
}) {
  const impact = worstReportImpact(report);
  const display = impactDisplay(impact);
  const impactLabel = impact === undefined ? "No impact" : display.label;
  const open = report.status !== "resolved";
  const startedAt = reportStartedAt(report);
  const resolvedAt = reportResolvedAt(report);
  return (
    <EventListItem
      className={type ? "[--event-list-media:2.75rem]" : undefined}
    >
      <EventListMedia>
        {type ? (
          <TypeTag
            label="Status report"
            variant={open ? statusVariants[report.status] : "default"}
          >
            RPT
          </TypeTag>
        ) : (
          <SeverityBars
            level={impact ? impactLevel[impact] : 0}
            variant={display.variant}
            label={impactLabel}
          />
        )}
      </EventListMedia>
      <EventListContent>
        <EventListTitle asChild>
          <NextLink
            href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
          >
            {report.title}
          </NextLink>
        </EventListTitle>
        <EventListDescription>
          {open && type ? (
            <span className="text-foreground font-medium capitalize">
              {report.status}
            </span>
          ) : open ? (
            <StatusReportStatusBadge status={report.status} plain />
          ) : null}
          <span>{impactLabel}</span>
          {type ? (
            <EventListTime date={startedAt} className="hidden lg:inline">
              {formatEventDate(startedAt)}
            </EventListTime>
          ) : null}
          <EventListTime date={startedAt} className="lg:hidden" />
        </EventListDescription>
      </EventListContent>
      {open ? (
        <EventListActions>
          <FormSheetStatusReportUpdateCreate report={report}>
            <Button variant="outline" size="sm" className="h-7">
              Add update
            </Button>
          </FormSheetStatusReportUpdateCreate>
        </EventListActions>
      ) : null}
      <EventListMeta>
        <EventListTime date={startedAt} />
        <EventListDetail>
          {/* a single update, or a legacy report at epoch, has no span to show */}
          {resolvedAt && startedAt.getTime() > 0 && resolvedAt > startedAt
            ? `lasted ${formatDurationShort(resolvedAt.getTime() - startedAt.getTime())}`
            : pluralize(report.updates.length, "update")}
        </EventListDetail>
      </EventListMeta>
    </EventListItem>
  );
}
