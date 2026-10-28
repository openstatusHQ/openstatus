"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Acknowledge, Check, Close, Reset } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { personName } from "@openstatus/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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
import { QuickActions } from "@/components/dropdowns/quick-actions";
import {
  incidentEndedAt,
  severityConfig,
  severityLevels,
  statusConfig,
} from "@/data/managed-incidents.client";
import {
  formatClockOrDay,
  formatDurationShort,
  formatWindow,
} from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { ConfirmCloseDialog } from "./confirm-close-dialog";
import { ResolveReportDialog } from "./resolve-report-dialog";

type Incident = NonNullable<RouterOutputs["incident"]["list"]>[number];
type IncidentStatus = Incident["status"];

const transitionActions = {
  mitigated: { label: "Mitigate", icon: Acknowledge },
  resolved: { label: "Resolve", icon: Check },
  open: { label: "Reopen", icon: Reset },
  canceled: { label: "Cancel", icon: Close },
} satisfies Record<IncidentStatus, { label: string; icon: unknown }>;

/** `kind` labels the row by type for a mixed list; the bars still carry the severity. */
export function IncidentRow({
  incident,
  kind = false,
}: {
  incident: Incident;
  kind?: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [confirmCancel, setConfirmCancel] = useState(false);
  // offered once the incident ends while its report is still open
  const [followUp, setFollowUp] = useState<string | null>(null);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.incident.list.queryKey() });
  const setStatus = useMutation(
    trpc.incident.setStatus.mutationOptions({
      onSuccess: (row) => {
        setConfirmCancel(false);
        const report = incident.statusReport;
        if (
          row &&
          report &&
          report.status !== "resolved" &&
          (row.status === "resolved" || row.status === "canceled")
        ) {
          // refetch on dialog close: it moves the row to the closed list and unmounts it
          setFollowUp(
            row.status === "resolved"
              ? "This incident has been resolved."
              : "This incident has been canceled.",
          );
          return;
        }
        return invalidate();
      },
      onError: (error) => toast.error(errorMessage(error, "Failed to save")),
    }),
  );
  const remove = useMutation(
    trpc.incident.delete.mutationOptions({ onSuccess: invalidate }),
  );

  const open = incident.status === "open" || incident.status === "mitigated";
  const severity = severityConfig[incident.severity];
  const status = statusConfig[incident.status];
  const endedAt = incidentEndedAt(incident);
  const meta = open
    ? [
        kind ? status.label.toLowerCase() : null,
        `since ${formatClockOrDay(incident.startedAt)}`,
      ]
    : incident.status === "canceled"
      ? [kind ? "canceled" : null]
      : [
          endedAt ? formatWindow(incident.startedAt, endedAt) : null,
          // resolved but still awaiting the close (postmortem) step
          incident.closedAt === null ? "not closed" : null,
        ];
  const commander = incident.commander
    ? { ...incident.commander, name: personName(incident.commander) }
    : null;
  const duration =
    incident.status === "canceled"
      ? "–"
      : formatDurationShort(
          (endedAt ?? new Date()).getTime() - incident.startedAt.getTime(),
        );
  const allowed = new Set(incident.allowedTransitions);
  // canceling closes the incident for good; ask first
  const transition = (next: IncidentStatus) =>
    next === "canceled"
      ? setConfirmCancel(true)
      : setStatus.mutate({ id: incident.id, status: next });

  return (
    <EventRow>
      <EventRowDate date={incident.startedAt} />
      <EventRowStatus>
        <StatusBars
          level={severityLevels[incident.severity]}
          variant={severity.variant}
        />
        <span>{kind ? "Incident" : status.label}</span>
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle href={`/incidents/${incident.id}`}>
          {incident.title}
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
        {(["mitigated", "resolved"] as const)
          .filter((next) => allowed.has(next))
          .map((next) => (
            <Button
              key={next}
              variant="outline"
              size="sm"
              className="h-7"
              disabled={setStatus.isPending}
              onClick={() => transition(next)}
            >
              {transitionActions[next].label}
            </Button>
          ))}
      </EventRowActions>
      <EventRowActor actor={commander} label="Commander" />
      <EventRowDuration>{duration}</EventRowDuration>
      <EventRowMenu>
        <QuickActions
          actions={(
            Object.keys(transitionActions) as (keyof typeof transitionActions)[]
          )
            .filter((next) => allowed.has(next))
            .map((next) => ({
              id: next,
              ...transitionActions[next],
              variant: "default" as const,
              onClick: () => transition(next),
            }))}
          deleteAction={
            incident.deletable
              ? {
                  confirmationValue: incident.title,
                  submitAction: async () => {
                    await remove.mutateAsync({ id: incident.id });
                  },
                }
              : undefined
          }
        />
      </EventRowMenu>
      <ConfirmCloseDialog
        kind="cancel"
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        pending={setStatus.isPending}
        onConfirm={() =>
          setStatus.mutate({ id: incident.id, status: "canceled" })
        }
      />
      {incident.statusReport ? (
        <ResolveReportDialog
          report={incident.statusReport}
          canNotify={workspace?.limits["status-subscribers"] === true}
          defaultMessage={followUp ?? ""}
          open={followUp !== null}
          onOpenChange={(isOpen) => {
            if (isOpen) return;
            setFollowUp(null);
            void invalidate();
          }}
        />
      ) : null}
    </EventRow>
  );
}
