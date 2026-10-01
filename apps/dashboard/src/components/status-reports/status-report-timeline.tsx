"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Next } from "@openstatus/icons";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineBody,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from "@/components/content/timeline";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { icons } from "@/data/icons";
import {
  getActions,
  impactConfig,
  impactsEqual,
  statusVariants,
} from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateStatusReport } from "./use-invalidate-status-report";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;
type StatusReportUpdate = StatusReport["updates"][number];

export function StatusReportTimelineItem({
  report,
  update,
  index,
}: {
  report: StatusReport;
  update: StatusReportUpdate;
  /** 1-based, counted from the oldest update. */
  index: number;
}) {
  const trpc = useTRPC();
  const [editing, setEditing] = useState(false);
  const invalidate = useInvalidateStatusReport(report.id);
  const onError = (error: { message: string }) => {
    toast.error(errorMessage(error, "Failed to save"));
  };
  const edit = useMutation(
    trpc.statusReport.updateStatusReportUpdate.mutationOptions({
      onSuccess: invalidate,
      onError,
    }),
  );
  const remove = useMutation(
    trpc.statusReport.deleteUpdate.mutationOptions({ onSuccess: invalidate }),
  );
  const components = report.pageComponents.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const Icon = icons.status[update.status];
  const impacts = update.componentImpacts.flatMap((ci) => {
    const component = components.find((c) => c.id === ci.pageComponentId);
    return component ? [{ ...ci, name: component.name }] : [];
  });

  return (
    <TimelineItem>
      <TimelineIndicator variant={statusVariants[update.status]}>
        <Icon />
      </TimelineIndicator>
      <TimelineContent>
        <TimelineHeader>
          <TimelineTitle>
            <StatusDot variant={statusVariants[update.status]} />
            <span className="font-mono font-semibold capitalize">
              {update.status}
            </span>
          </TimelineTitle>
          <TimelineTime date={update.date}>
            {format(update.date, "MM/dd/yyyy, hh:mm a")}
          </TimelineTime>
        </TimelineHeader>
        {impacts.length ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {impacts.map((ci) => (
              <span
                key={ci.pageComponentId}
                className="inline-flex items-center gap-1.5"
              >
                <span className="font-mono">{ci.name}</span>
                <Next className="text-muted-foreground/50 size-3" />
                <StatusDot variant={impactConfig[ci.impact].variant} />
                <span className="font-mono">
                  {impactConfig[ci.impact].label}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {update.message ? (
          <TimelineBody className="prose prose-sm dark:prose-invert max-w-none">
            <ProcessMessage value={update.message} />
          </TimelineBody>
        ) : null}
        <div className="text-muted-foreground flex items-center justify-between gap-2 font-mono text-xs">
          <span>#{index}</span>
          <QuickActions
            actions={getActions({ edit: () => setEditing(true) })}
            deleteAction={{
              description: `Permanently remove update #${index}. The report status is recomputed from the remaining updates.`,
              submitAction: async () => {
                await remove.mutateAsync({ id: update.id });
              },
            }}
          />
        </div>
      </TimelineContent>
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
