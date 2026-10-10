"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { Report } from "@openstatus/icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import {
  ComponentImpact,
  ComponentListName,
} from "@/components/content/component-list";
import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineActions,
  TimelineActor,
  TimelineBody,
  TimelineCard,
  TimelineFooter,
  TimelineHeader,
  TimelineHighlight,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
} from "@/components/content/timeline";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { distinctEditor } from "@/data/attribution.client";
import { getActions, impactsEqual } from "@/data/status-report-updates.client";
import { reportStartedAt } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";

import { StatusReportStatusBadge } from "./status-report-badge";
import { useInvalidateStatusReport } from "./use-invalidate-status-report";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;
type StatusReportUpdate = StatusReport["updates"][number];

// Components whose impact this update moved; a page starts operational, so
// the first update lists everything it degraded and a resolve lists what it
// restored. Legacy updates carry no rows and change nothing.
function changedImpacts(
  update: StatusReportUpdate,
  previous: StatusReportUpdate | null,
): { pageComponentId: number; impact: PageComponentImpact }[] {
  const before = new Map(
    previous?.componentImpacts.map((ci) => [ci.pageComponentId, ci.impact]),
  );
  return update.componentImpacts.filter(
    (ci) => ci.impact !== (before.get(ci.pageComponentId) ?? "operational"),
  );
}

export function StatusReportTimelineItem({
  report,
  update,
  previous,
  index,
  groupOf,
}: {
  report: StatusReport;
  update: StatusReportUpdate;
  /** The update before this one, oldest first; `null` for the first. */
  previous: StatusReportUpdate | null;
  /** 1-based, counted from the oldest update. */
  index: number;
  /** component id → group name, for disambiguating same-named components */
  groupOf?: Map<number, string>;
}) {
  const trpc = useTRPC();
  const [editing, setEditing] = useState(false);
  const invalidate = useInvalidateStatusReport(report.id);
  const edit = useMutation(
    trpc.statusReport.updateStatusReportUpdate.mutationOptions({
      onSuccess: invalidate,
    }),
  );
  const remove = useMutation(
    trpc.statusReport.deleteUpdate.mutationOptions({ onSuccess: invalidate }),
  );
  const components = report.pageComponents.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const author = update.createdByUser;
  const editor = distinctEditor(update);
  const changes = changedImpacts(update, previous).flatMap((ci) => {
    const component = components.find((c) => c.id === ci.pageComponentId);
    return component ? [{ ...component, impact: ci.impact }] : [];
  });

  return (
    <TimelineItem>
      <TimelineCard>
        <TimelineHeader>
          {author ? (
            <>
              <TimelineActor actor={author} avatar /> posted
            </>
          ) : (
            "Posted"
          )}
          <StatusReportStatusBadge status={update.status} />
          <TimelineTime date={update.date} />
          {editor ? (
            <>
              · edited by <TimelineActor actor={editor} />
            </>
          ) : null}
          <TimelineActions>
            <span>#{index}</span>
            <QuickActions
              actions={getActions({ edit: () => setEditing(true) })}
              deleteAction={
                // a report keeps at least one update; delete the report instead
                report.updates.length > 1
                  ? {
                      description: `Permanently remove update #${index}. The report status is recomputed from the remaining updates.`,
                      submitAction: async () => {
                        await remove.mutateAsync({ id: update.id });
                      },
                    }
                  : undefined
              }
            />
          </TimelineActions>
        </TimelineHeader>
        {update.message ? (
          <TimelineBody>
            <ProcessMessage value={update.message} />
          </TimelineBody>
        ) : null}
        {changes.length ? (
          <TimelineFooter>
            {changes.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-2">
                <ComponentListName group={groupOf?.get(c.id)}>
                  {c.name}
                </ComponentListName>
                <ComponentImpact
                  impact={c.impact}
                  className="text-foreground"
                />
              </span>
            ))}
          </TimelineFooter>
        ) : null}
      </TimelineCard>
      <FormSheetStatusReportUpdate
        open={editing}
        onOpenChange={setEditing}
        defaultValues={{
          message: update.message,
          date: update.date,
          status: update.status,
          componentImpacts: update.componentImpacts.map((ci) => ({
            pageComponentId: ci.pageComponentId,
            impact: ci.impact,
          })),
        }}
        components={components}
        allowUnsetImpacts
        onSubmit={async (values) => {
          await edit.mutateAsync({
            id: update.id,
            statusReportId: report.id,
            message: values.message,
            status: values.status,
            // replace-set semantics: untouched (incl. legacy) rows keep their set
            componentImpacts: impactsEqual(
              values.componentImpacts ?? [],
              update.componentImpacts,
            )
              ? undefined
              : values.componentImpacts,
            date: values.date,
          });
        }}
      />
    </TimelineItem>
  );
}

/** Closing row: who opened the report, and on which page. */
export function StatusReportOpenedTimelineItem({
  report,
}: {
  report: StatusReport;
}) {
  return (
    <TimelineItem>
      <TimelineIndicator>
        <Report />
      </TimelineIndicator>
      <TimelineHeader>
        {report.createdByUser ? (
          <>
            <TimelineActor actor={report.createdByUser} /> opened the report on
          </>
        ) : (
          "Report opened on"
        )}
        <TimelineHighlight>{report.page.title}</TimelineHighlight>
        <TimelineTime date={reportStartedAt(report)} />
      </TimelineHeader>
    </TimelineItem>
  );
}
