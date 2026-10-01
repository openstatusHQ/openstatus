"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  type PageComponentImpact,
  worstImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import {
  ComponentImpact,
  ComponentListName,
} from "@/components/content/component-list";
import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineActor,
  TimelineBody,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineMeta,
  TimelineTime,
  TimelineTitle,
} from "@/components/content/timeline";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { icons } from "@/data/icons";
import {
  getActions,
  impactsEqual,
  statusVariants,
} from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";

import { StatusReportImpactBadge } from "./status-report-badge";
import { useInvalidateStatusReport } from "./use-invalidate-status-report";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;
type StatusReportUpdate = StatusReport["updates"][number];

/** Worst impact of the update; hover lists each component's own impact. */
function TimelineImpact({
  impacts,
}: {
  impacts: {
    id: number;
    name: string;
    group?: string;
    impact: PageComponentImpact;
  }[];
}) {
  const worst = worstImpact(impacts.map((i) => i.impact));
  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <StatusReportImpactBadge
          impact={worst}
          tabIndex={0}
          className="focus-visible:ring-ring/50 cursor-default outline-none focus-visible:ring-[3px]"
        />
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto min-w-56 p-3">
        <ul className="flex flex-col gap-1.5 text-xs">
          {impacts.map((ci) => (
            <li key={ci.id} className="flex items-center justify-between gap-4">
              <ComponentListName group={ci.group}>{ci.name}</ComponentListName>
              <ComponentImpact impact={ci.impact} />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function StatusReportTimelineItem({
  report,
  update,
  index,
  groupOf,
}: {
  report: StatusReport;
  update: StatusReportUpdate;
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
  const Icon = icons.status[update.status];
  // Every update is a status change, so the colored indicator keeps the rail
  // and the author sits inline, as on incident state-change rows.
  const author = update.createdByUser;
  const editor =
    update.updatedByUser && update.updatedByUser.id !== author?.id
      ? update.updatedByUser
      : null;
  const impacts = update.componentImpacts.flatMap((ci) => {
    const component = components.find((c) => c.id === ci.pageComponentId);
    return component
      ? [
          {
            id: component.id,
            name: component.name,
            group: groupOf?.get(component.id),
            impact: ci.impact,
          },
        ]
      : [];
  });

  return (
    <TimelineItem>
      <TimelineIndicator variant={statusVariants[update.status]}>
        <Icon />
      </TimelineIndicator>
      <TimelineContent>
        <TimelineHeader>
          <TimelineTitle>
            <span className="capitalize">{update.status}</span>
            {impacts.length ? <TimelineImpact impacts={impacts} /> : null}
            {author ? <TimelineActor actor={author} /> : null}
            {editor ? (
              <TimelineMeta className="inline-flex items-center gap-1.5">
                edited by <TimelineActor actor={editor} />
              </TimelineMeta>
            ) : null}
          </TimelineTitle>
          <TimelineTime date={update.date} />
        </TimelineHeader>
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
