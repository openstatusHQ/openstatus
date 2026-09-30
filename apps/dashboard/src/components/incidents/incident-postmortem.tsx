"use client";

import type { RouterOutputs } from "@openstatus/api";
import { AI } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { InputGroupButton } from "@openstatus/ui/components/ui/input-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/status-badge";
import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerHint,
  ComposerPreview,
  ComposerTabs,
  ComposerTextarea,
} from "@/components/content/composer";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateIncident } from "./use-invalidate-incident";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

const TEMPLATE = `## Summary

## Impact

## Timeline

## Root cause

## What went well

## What went wrong

## Action items
- [ ] `;

function errorText(error: { message: string }) {
  return isTRPCClientError(error) ? error.message : "Something went wrong";
}

/** The postmortem editor: draft by hand or with the agent, then approve. */
export function IncidentPostmortem({
  incident,
  agentAllowed,
}: {
  incident: Incident;
  agentAllowed: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateIncident(incident.id);
  const { data: postmortem } = useQuery(
    trpc.incident.getPostmortem.queryOptions({ id: incident.id }),
  );
  // null = pristine: the editor follows the server copy, so a background
  // refetch never clobbers unsaved edits.
  const [draft, setDraft] = useState<string | null>(null);
  const server = postmortem?.content ?? TEMPLATE;
  const content = draft ?? server;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.incident.getPostmortem.queryKey({ id: incident.id }),
      }),
      invalidate(),
    ]);
  const onError = (error: { message: string }) => {
    toast.error(errorText(error));
  };

  const save = useMutation(
    trpc.incident.draftPostmortem.mutationOptions({
      onSuccess: () => {
        toast.success("Postmortem saved");
        return refresh().then(() => setDraft(null));
      },
      onError,
    }),
  );
  const draftWithAgent = useMutation(
    trpc.incident.draftPostmortemWithAgent.mutationOptions({
      onSuccess: () => {
        toast.success("Draft ready");
        return refresh().then(() => setDraft(null));
      },
      onError,
    }),
  );
  const approve = useMutation(
    trpc.incident.approvePostmortem.mutationOptions({
      onSuccess: () => {
        toast.success("Postmortem approved");
        return refresh();
      },
      onError,
    }),
  );

  if (incident.status !== "resolved") {
    return (
      <EmptyStateContainer>
        <EmptyStateTitle>No postmortem yet</EmptyStateTitle>
        <EmptyStateDescription>
          The postmortem opens once the incident is resolved.
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }
  // The default tab depends on the server copy; mounting earlier would pin it.
  if (postmortem === undefined) return null;

  const approved = postmortem?.status === "approved";
  const dirty = draft !== null && draft !== server;
  const busy = save.isPending || draftWithAgent.isPending || approve.isPending;
  const canSave = !busy && dirty && content.trim().length > 0;
  const canApprove = postmortem !== null && !approved;

  const hint = dirty
    ? "Unsaved changes"
    : approved && incident.closedAt === null
      ? "Close the incident from the header"
      : postmortem?.draftedBy === "agent"
        ? "Drafted by the agent"
        : postmortem
          ? null
          : "No postmortem yet";

  return (
    <Composer defaultValue={approved ? "preview" : "write"}>
      <ComposerHeader>
        <ComposerTabs />
        {agentAllowed && !approved ? (
          <InputGroupButton
            variant="outline"
            disabled={busy}
            onClick={() => draftWithAgent.mutate({ id: incident.id })}
          >
            <AI />
            {draftWithAgent.isPending ? "Drafting..." : "Draft with agent"}
          </InputGroupButton>
        ) : (
          <ComposerHint>Markdown</ComposerHint>
        )}
      </ComposerHeader>
      <ComposerTextarea
        aria-label="Postmortem"
        className="min-h-96"
        value={content}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave) {
            e.preventDefault();
            save.mutate({ id: incident.id, content, draftedBy: "user" });
          }
        }}
      />
      <ComposerPreview value={content} className="min-h-96" />
      <ComposerFooter>
        <div className="flex items-center gap-2">
          {postmortem ? (
            <StatusBadge
              dot
              variant={approved ? "success" : "default"}
              className="bg-background"
            >
              {approved ? "Approved" : "Draft"}
            </StatusBadge>
          ) : null}
          {hint ? <span className="text-xs">{hint}</span> : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={canApprove ? "outline" : "default"}
            disabled={!canSave}
            onClick={() =>
              save.mutate({ id: incident.id, content, draftedBy: "user" })
            }
          >
            Save
          </Button>
          {canApprove ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || dirty}
                onClick={() => approve.mutate({ id: incident.id })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                disabled={busy || dirty || incident.closedAt !== null}
                onClick={() => approve.mutate({ id: incident.id, close: true })}
              >
                Approve & close
              </Button>
            </>
          ) : null}
        </div>
      </ComposerFooter>
    </Composer>
  );
}
