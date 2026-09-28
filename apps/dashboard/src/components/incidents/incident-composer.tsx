"use client";

import type { IncidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import { ProcessMessage } from "@/components/content/process-message";
import { statusConfig } from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";

const UNCHANGED = "unchanged";

/**
 * Posting with the status unchanged adds a note; picking a new status moves
 * the incident and carries the text on the same timeline event.
 */
export function IncidentComposer({
  incident,
  onStatusChanged,
}: {
  incident: {
    id: number;
    status: IncidentStatus;
    allowedTransitions: ReadonlyArray<IncidentStatus>;
  };
  onStatusChanged: (status: IncidentStatus, note: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>(UNCHANGED);
  const [message, setMessage] = useState("");

  const invalidate = () =>
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

  const addNote = useMutation(
    trpc.incident.addNote.mutationOptions({ onSuccess: invalidate }),
  );
  const setIncidentStatus = useMutation(
    trpc.incident.setStatus.mutationOptions({ onSuccess: invalidate }),
  );
  const pending = addNote.isPending || setIncidentStatus.isPending;
  const next = incident.allowedTransitions.find((s) => s === status);

  async function submit() {
    const note = message.trim();
    const promise: Promise<void> = next
      ? setIncidentStatus
          .mutateAsync({
            id: incident.id,
            status: next,
            note: note || undefined,
          })
          .then(() => undefined)
      : addNote
          .mutateAsync({ id: incident.id, message: note })
          .then(() => undefined);
    toast.promise(promise, {
      loading: "Posting...",
      success: "Posted",
      error: (error) =>
        isTRPCClientError(error) ? error.message : "Failed to post",
    });
    await promise;
    setMessage("");
    setStatus(UNCHANGED);
    if (next) onStatusChanged(next, note);
  }

  const disabled = pending || (!next && !message.trim());

  return (
    <div className="bg-background grid gap-2 rounded-lg border p-3">
      <Tabs defaultValue="write">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-[180px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCHANGED}>
                {statusConfig[incident.status].label} (unchanged)
              </SelectItem>
              {incident.allowedTransitions.map((s) => (
                <SelectItem key={s} value={s}>
                  Mark {statusConfig[s].label.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsContent value="write">
          <Textarea
            rows={4}
            placeholder="What's happening? Markdown supported."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="prose dark:prose-invert prose-sm min-h-24 rounded-md border px-3 py-2">
            <ProcessMessage value={message || "_Nothing to preview._"} />
          </div>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end">
        <Button size="sm" disabled={disabled} onClick={() => submit()}>
          {next
            ? `Post and mark ${statusConfig[next].label.toLowerCase()}`
            : "Post note"}
        </Button>
      </div>
    </div>
  );
}
