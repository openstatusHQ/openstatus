"use client";

import type { RouterOutputs } from "@openstatus/api";
import { incidentSeverity } from "@openstatus/db/src/schema/incidents/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { formatDistanceStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import { FormAlertDialog } from "@/components/forms/form-alert-dialog";
import { toLocalInput } from "@/components/forms/incident/form";
import {
  personName,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

const NONE = "none";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function slackChannelUrl(teamId: string, channelId: string): string {
  return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}`;
}

export function IncidentProperties({ incident }: { incident: Incident }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const [startedAt, setStartedAt] = useState(toLocalInput(incident.startedAt));
  const closed = incident.closedAt !== null;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.incident.get.queryKey({ id: incident.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.listEvents.queryKey({ id: incident.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.list.queryKey(),
      }),
    ]);
  const onError = (error: { message: string }) => {
    toast.error(isTRPCClientError(error) ? error.message : "Failed to save");
  };

  const update = useMutation(
    trpc.incident.update.mutationOptions({ onSuccess: refresh, onError }),
  );
  const close = useMutation(
    trpc.incident.close.mutationOptions({ onSuccess: refresh, onError }),
  );
  const remove = useMutation(
    trpc.incident.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.incident.list.queryKey(),
        });
        router.push("/incidents");
      },
    }),
  );

  const end =
    incident.status === "resolved" && incident.resolvedAt
      ? incident.resolvedAt
      : (incident.closedAt ?? new Date());

  return (
    <div className="grid gap-3">
      <Row label="Severity">
        <Select
          disabled={closed}
          value={incident.severity}
          onValueChange={(value) => {
            const severity = incidentSeverity.find((s) => s === value);
            if (severity) update.mutate({ id: incident.id, severity });
          }}
        >
          <SelectTrigger size="sm" className="w-full font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {incidentSeverity.map((severity) => (
              <SelectItem key={severity} value={severity}>
                {severityConfig[severity].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Status">
        <span
          className={`font-mono ${statusConfig[incident.status].className}`}
        >
          {statusConfig[incident.status].label}
          {closed && incident.status !== "canceled" ? " · closed" : null}
        </span>
      </Row>
      <Row label="Commander">
        <Select
          disabled={closed}
          value={incident.commanderId ? String(incident.commanderId) : NONE}
          onValueChange={(value) =>
            update.mutate({
              id: incident.id,
              commanderId: value === NONE ? null : Number(value),
            })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No commander</SelectItem>
            {(members ?? []).map((member) => (
              <SelectItem key={member.user.id} value={String(member.user.id)}>
                {personName(member.user) ?? `User ${member.user.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Started at">
        <div className="flex gap-1">
          <Input
            type="datetime-local"
            disabled={closed}
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
          {startedAt !== toLocalInput(incident.startedAt) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                update.mutate({
                  id: incident.id,
                  startedAt: new Date(startedAt),
                })
              }
            >
              Save
            </Button>
          ) : null}
        </div>
      </Row>
      <Row label="Duration">
        <span className="font-mono">
          {formatDistanceStrict(incident.startedAt, end)}
        </span>
      </Row>
      <Row label="Declared by">
        {personName(incident.declaredByUser) ?? "System"}
      </Row>
      <Row label="Slack">
        {incident.slackTeamId && incident.slackChannelId ? (
          <Link
            href={slackChannelUrl(
              incident.slackTeamId,
              incident.slackChannelId,
            )}
            target="_blank"
            rel="noreferrer"
          >
            Open channel
          </Link>
        ) : (
          <span className="text-muted-foreground">No channel</span>
        )}
      </Row>
      <div className="flex flex-wrap gap-2 pt-2">
        {incident.status === "resolved" && !closed ? (
          <Button
            size="sm"
            variant="outline"
            disabled={close.isPending}
            onClick={() => close.mutate({ id: incident.id })}
          >
            Close incident
          </Button>
        ) : null}
        {incident.deletable ? (
          <FormAlertDialog
            confirmationValue={incident.title}
            submitAction={async () => {
              await remove.mutateAsync({ id: incident.id });
            }}
          >
            <Button size="sm" variant="destructive">
              Delete
            </Button>
          </FormAlertDialog>
        ) : null}
      </div>
    </div>
  );
}
