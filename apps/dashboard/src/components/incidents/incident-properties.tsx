"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  INCIDENT_REPORTED_AT_MAX_BEFORE_MS,
  type IncidentStatus,
  incidentSeverity,
} from "@openstatus/db/src/schema/incidents/constants";
import { Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { personName } from "@openstatus/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  format,
  formatDistanceStrict,
  formatDistanceToNowStrict,
} from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { StatusDot } from "@/components/common/status-dot";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Property,
  PropertyDateTimePicker,
  PropertyLabel,
  PropertyList,
  PropertyMeta,
  PropertySelectTrigger,
  PropertyValue,
} from "@/components/content/property-list";
import {
  incidentEndedAt,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { ConfirmCloseDialog } from "./confirm-close-dialog";
import { useInvalidateIncident } from "./use-invalidate-incident";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

const NONE = "none";

export function IncidentProperties({
  incident,
  lastUpdateAt,
  onStatusChanged,
}: {
  incident: Incident;
  lastUpdateAt?: Date;
  onStatusChanged: (status: IncidentStatus, note: string) => void;
}) {
  const trpc = useTRPC();
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const closed = incident.closedAt !== null;

  const invalidate = useInvalidateIncident(incident.id);
  const onError = (error: { message: string }) => {
    toast.error(errorMessage(error, "Failed to save"));
  };
  const update = useMutation(
    trpc.incident.update.mutationOptions({
      onSuccess: invalidate,
      onError,
    }),
  );
  const setStatus = useMutation(
    trpc.incident.setStatus.mutationOptions({
      onSuccess: async (row) => {
        await invalidate();
        setConfirmCancel(false);
        if (row) onStatusChanged(row.status, "");
      },
      onError,
    }),
  );

  const severity = severityConfig[incident.severity];
  const status = statusConfig[incident.status];
  const commander = personName(incident.commander);
  const endedAt = incidentEndedAt(incident);
  const declaredBy = personName(incident.declaredByUser);
  const acknowledgedBy = personName(incident.acknowledgedByUser);
  const acknowledgedAtLabel = !incident.acknowledgedAt
    ? null
    : incident.acknowledgedAt.getTime() === incident.declaredAt.getTime()
      ? "at declare"
      : format(incident.acknowledgedAt, "LLL dd, HH:mm");

  return (
    <PropertyList>
      <ConfirmCloseDialog
        kind="cancel"
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        pending={setStatus.isPending}
        onConfirm={() =>
          setStatus.mutate({ id: incident.id, status: "canceled" })
        }
      />
      <Property>
        <PropertyLabel>Severity</PropertyLabel>
        <PropertyValue>
          {closed ? (
            <>
              <StatusDot variant={severity.variant} className="rounded-xs" />
              {severity.label}
            </>
          ) : (
            <Select
              value={incident.severity}
              onValueChange={(value) => {
                const next = incidentSeverity.find((s) => s === value);
                if (next) update.mutate({ id: incident.id, severity: next });
              }}
            >
              <PropertySelectTrigger aria-label="Severity">
                <SelectValue />
              </PropertySelectTrigger>
              <SelectContent>
                {incidentSeverity.map((s) => (
                  <SelectItem key={s} value={s} className="font-mono">
                    <StatusDot
                      variant={severityConfig[s].variant}
                      className="rounded-xs"
                    />
                    {severityConfig[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Status</PropertyLabel>
        <PropertyValue>
          {incident.allowedTransitions.length === 0 ? (
            <>
              <StatusDot variant={status.variant} />
              {status.label}
              {closed && incident.status !== "canceled" ? " · closed" : null}
            </>
          ) : (
            <Select
              value={incident.status}
              onValueChange={(value) => {
                const next = incident.allowedTransitions.find(
                  (s) => s === value,
                );
                if (!next) return;
                // Canceling closes the incident for good; ask first.
                if (next === "canceled") setConfirmCancel(true);
                else setStatus.mutate({ id: incident.id, status: next });
              }}
            >
              <PropertySelectTrigger aria-label="Status">
                <SelectValue />
              </PropertySelectTrigger>
              <SelectContent>
                {[incident.status, ...incident.allowedTransitions].map((s) => (
                  <SelectItem key={s} value={s} className="font-mono">
                    <StatusDot variant={statusConfig[s].variant} />
                    {statusConfig[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Commander</PropertyLabel>
        <PropertyValue>
          {closed ? (
            commander ? (
              <>
                <UserAvatar
                  name={commander}
                  src={incident.commander?.photoUrl}
                />
                <span className="truncate">{commander}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No commander</span>
            )
          ) : (
            <Select
              value={incident.commanderId ? String(incident.commanderId) : NONE}
              onValueChange={(value) =>
                update.mutate({
                  id: incident.id,
                  commanderId: value === NONE ? null : Number(value),
                })
              }
            >
              <PropertySelectTrigger aria-label="Commander">
                <SelectValue />
              </PropertySelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="font-mono">
                  <span className="text-muted-foreground">No commander</span>
                </SelectItem>
                {(members ?? []).map((member) => {
                  const name =
                    personName(member.user) ?? `User ${member.user.id}`;
                  return (
                    <SelectItem
                      key={member.user.id}
                      value={String(member.user.id)}
                      className="font-mono"
                    >
                      <UserAvatar name={name} src={member.user.photoUrl} />
                      <span className="truncate">{name}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Started at</PropertyLabel>
        <PropertyValue>
          <HoverCardTimestamp date={incident.startedAt} side="left">
            <span>{format(incident.startedAt, "LLL dd, y HH:mm")}</span>
          </HoverCardTimestamp>
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Reported at</PropertyLabel>
        <PropertyValue>
          {closed ? (
            incident.reportedAt ? (
              <HoverCardTimestamp date={incident.reportedAt} side="left">
                <span>{format(incident.reportedAt, "LLL dd, y HH:mm")}</span>
              </HoverCardTimestamp>
            ) : (
              <span className="text-muted-foreground">At declare</span>
            )
          ) : (
            <>
              <PropertyDateTimePicker
                aria-label="Reported at"
                className={incident.reportedAt ? "w-auto flex-1" : undefined}
                value={incident.reportedAt ?? incident.declaredAt}
                min={
                  new Date(
                    incident.declaredAt.getTime() -
                      INCIDENT_REPORTED_AT_MAX_BEFORE_MS,
                  )
                }
                max={incident.declaredAt}
                onChange={(reportedAt) =>
                  update.mutate({ id: incident.id, reportedAt })
                }
              >
                {incident.reportedAt ? (
                  format(incident.reportedAt, "LLL dd, y HH:mm")
                ) : (
                  <span className="text-muted-foreground">At declare</span>
                )}
              </PropertyDateTimePicker>
              {incident.reportedAt ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Clear reported at"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ id: incident.id, reportedAt: null })
                  }
                >
                  <Close className="opacity-50" />
                </Button>
              ) : null}
            </>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Duration</PropertyLabel>
        <PropertyValue>
          {endedAt ? null : (
            <>
              <StatusDot variant="destructive" />
              <span className="sr-only">ongoing</span>
            </>
          )}
          {formatDistanceStrict(incident.startedAt, endedAt ?? new Date())}
        </PropertyValue>
      </Property>
      {lastUpdateAt ? (
        <Property>
          <PropertyLabel>Last update</PropertyLabel>
          <PropertyValue>
            <HoverCardTimestamp date={lastUpdateAt} side="left">
              <span>
                {formatDistanceToNowStrict(lastUpdateAt, { addSuffix: true })}
              </span>
            </HoverCardTimestamp>
          </PropertyValue>
        </Property>
      ) : null}
      <Property>
        <PropertyLabel>Declared by</PropertyLabel>
        <PropertyValue>
          {declaredBy ? (
            <>
              <UserAvatar
                name={declaredBy}
                src={incident.declaredByUser?.photoUrl}
              />
              <span className="truncate">{declaredBy}</span>
            </>
          ) : (
            <span className="text-muted-foreground">System</span>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Acknowledged</PropertyLabel>
        <PropertyValue>
          {incident.acknowledgedAt ? (
            <>
              {acknowledgedBy ? (
                <>
                  <UserAvatar
                    name={acknowledgedBy}
                    src={incident.acknowledgedByUser?.photoUrl}
                  />
                  <span className="truncate">{acknowledgedBy}</span>
                </>
              ) : null}
              <HoverCardTimestamp date={incident.acknowledgedAt} side="left">
                {acknowledgedBy ? (
                  <PropertyMeta>{acknowledgedAtLabel}</PropertyMeta>
                ) : (
                  <span>{acknowledgedAtLabel}</span>
                )}
              </HoverCardTimestamp>
            </>
          ) : (
            <span className="text-muted-foreground">Not yet</span>
          )}
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
