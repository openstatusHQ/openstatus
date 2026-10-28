"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import { StatusBars } from "@/components/common/status-bars";
import {
  EventRow,
  EventRowActions,
  EventRowActor,
  EventRowContent,
  EventRowDate,
  EventRowDuration,
  EventRowMenu,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import { StatusReportRowActions } from "@/components/data-table/status-reports/data-table-row-actions";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { impactDisplay } from "@/data/status-report-updates.client";
import {
  impactLevels,
  reportResolvedAt,
  reportStartedAt,
  worstReportImpact,
} from "@/data/status-reports.client";
import { formatDurationShort, formatWindow } from "@/lib/formatter";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

const noComponents = { label: "No components", variant: "default" } as const;

/** `kind` labels the row by type for a mixed list; the bars still carry the impact. */
export function StatusReportRow({
  report,
  kind = false,
}: {
  report: StatusReport;
  kind?: boolean;
}) {
  // one sheet, two entry points: the next status, or straight to resolved
  const [sheet, setSheet] = useState<"next" | "resolved" | null>(null);
  const ongoing = report.status !== "resolved";
  const impact = worstReportImpact(report);
  // grey, not green: an all-operational report still was a report
  const display =
    impact === undefined
      ? noComponents
      : impact === "operational"
        ? { label: "Operational", variant: "default" as const }
        : impactDisplay(impact);
  const startedAt = reportStartedAt(report);
  const resolvedAt = reportResolvedAt(report);
  // epoch = legacy report without dates
  const dated = startedAt.getTime() > 0;
  const updates = report.updates.length;
  const meta = ongoing
    ? [
        kind ? report.status : null,
        display.label.toLowerCase(),
        `${updates} ${updates === 1 ? "update" : "updates"}`,
      ]
    : resolvedAt && dated
      ? [formatWindow(startedAt, resolvedAt)]
      : [];
  const endedAt = resolvedAt ?? new Date();

  return (
    <EventRow>
      <EventRowDate date={startedAt} />
      <EventRowStatus>
        <StatusBars
          level={impact ? impactLevels[impact] : 0}
          variant={display.variant}
        />
        <span>{kind ? "Report" : ongoing ? report.status : display.label}</span>
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle
          href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
        >
          {report.title}
        </EventRowTitle>
        <EventRowMeta>
          {meta
            .filter((item) => item !== null)
            .map((item) => (
              <span key={item}>{item}</span>
            ))}
        </EventRowMeta>
      </EventRowContent>
      <EventRowActions>
        {ongoing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setSheet("next")}
            >
              Add update
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setSheet("resolved")}
            >
              Resolve
            </Button>
          </>
        ) : null}
      </EventRowActions>
      <EventRowActor actor={report.createdByUser} label="Created by" optional />
      <EventRowDuration>
        {dated
          ? formatDurationShort(endedAt.getTime() - startedAt.getTime())
          : "–"}
      </EventRowDuration>
      <EventRowMenu>
        <StatusReportRowActions
          report={report}
          onAddUpdate={ongoing ? () => setSheet("next") : undefined}
          onResolve={ongoing ? () => setSheet("resolved") : undefined}
        />
      </EventRowMenu>
      {ongoing ? (
        <FormSheetStatusReportUpdateCreate
          report={report}
          status={sheet === "resolved" ? "resolved" : undefined}
          open={sheet !== null}
          onOpenChange={(open) => {
            if (!open) setSheet(null);
          }}
        />
      ) : null}
    </EventRow>
  );
}
