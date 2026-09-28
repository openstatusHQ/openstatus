"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import { ProcessMessage } from "@/components/content/process-message";
import { useTRPC } from "@/lib/trpc/client";

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
      <p className="text-muted-foreground text-sm">
        The postmortem opens once the incident is resolved.
      </p>
    );
  }

  const approved = postmortem?.status === "approved";
  const dirty = draft !== null && draft !== server;
  const busy = save.isPending || draftWithAgent.isPending || approve.isPending;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {postmortem ? (
            <Badge variant="outline" className="font-mono capitalize">
              {postmortem.status}
            </Badge>
          ) : (
            <span className="text-muted-foreground">No postmortem yet</span>
          )}
          {postmortem?.draftedBy === "agent" ? (
            <span className="text-muted-foreground">Drafted by the agent</span>
          ) : null}
        </div>
        {agentAllowed && !approved ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => draftWithAgent.mutate({ id: incident.id })}
          >
            {draftWithAgent.isPending ? "Drafting..." : "Draft with agent"}
          </Button>
        ) : null}
      </div>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            rows={18}
            className="font-mono text-sm"
            value={content}
            onChange={(e) => setDraft(e.target.value)}
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="prose dark:prose-invert prose-sm max-w-none rounded-md border px-3 py-2">
            <ProcessMessage value={content} />
          </div>
        </TabsContent>
      </Tabs>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !dirty || !content.trim()}
          onClick={() =>
            save.mutate({ id: incident.id, content, draftedBy: "user" })
          }
        >
          Save
        </Button>
        {postmortem && !approved ? (
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
      {approved && incident.closedAt === null ? (
        <p className="text-muted-foreground text-right text-xs">
          Approved. Close the incident from the panel on the right.
        </p>
      ) : null}
    </div>
  );
}
