"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  type IncidentStatus,
  incidentSeverity,
} from "@openstatus/db/src/schema/incidents/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
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
  PropertyInput,
  PropertyLabel,
  PropertyList,
  PropertySelectTrigger,
  PropertyValue,
} from "@/components/content/property-list";
import { toLocalInput } from "@/components/forms/incident/form";
import {
  incidentEndedAt,
  personName,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";

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
  const [startedAt, setStartedAt] = useState(toLocalInput(incident.startedAt));
  const closed = incident.closedAt !== null;

  const invalidate = useInvalidateIncident(incident.id);
  const onError = (error: { message: string }) => {
    toast.error(isTRPCClientError(error) ? error.message : "Failed to save");
  };
  const update = useMutation(
    trpc.incident.update.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const setStatus = useMutation(
    trpc.incident.setStatus.mutationOptions({
      onSuccess: async (row) => {
        await invalidate();
        if (row) onStatusChanged(row.status, "");
      },
      onError,
    }),
  );

  const severity = severityConfig[incident.severity];
  const status = statusConfig[incident.status];
  const commander = personName(incident.commander);
  const endedAt = incidentEndedAt(incident);

  return (
    <PropertyList>
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
                if (next) setStatus.mutate({ id: incident.id, status: next });
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
                <UserAvatar name={commander} />
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
                      <UserAvatar name={name} />
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
        <PropertyValue className="flex-wrap">
          {closed ? (
            <HoverCardTimestamp date={incident.startedAt} side="left">
              <span>{format(incident.startedAt, "LLL dd, y HH:mm")}</span>
            </HoverCardTimestamp>
          ) : (
            <>
              <PropertyInput
                type="datetime-local"
                aria-label="Started at"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
              {startedAt !== toLocalInput(incident.startedAt) ? (
                <div className="flex gap-1 font-sans">
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={!startedAt || update.isPending}
                    onClick={() =>
                      update.mutate({
                        id: incident.id,
                        startedAt: new Date(startedAt),
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() =>
                      setStartedAt(toLocalInput(incident.startedAt))
                    }
                  >
                    Reset
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Duration</PropertyLabel>
        <PropertyValue>
          {formatDistanceStrict(incident.startedAt, endedAt ?? new Date())}
          {endedAt ? null : (
            <>
              <StatusDot variant="destructive" className="size-1.5" />
              <span className="sr-only">ongoing</span>
            </>
          )}
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
          <span className="truncate">
            {personName(incident.declaredByUser) ?? "System"}
          </span>
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
