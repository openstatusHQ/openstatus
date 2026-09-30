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
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerHint,
  ComposerPreview,
  ComposerTabs,
  ComposerTextarea,
} from "@/components/content/composer";
import { personName, statusConfig } from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateIncident } from "./use-invalidate-incident";

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
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const invalidate = useInvalidateIncident(incident.id);
  const addNote = useMutation(
    trpc.incident.addNote.mutationOptions({ onSuccess: invalidate }),
  );
  const setIncidentStatus = useMutation(
    trpc.incident.setStatus.mutationOptions({ onSuccess: invalidate }),
  );
  const pending = addNote.isPending || setIncidentStatus.isPending;
  const next = incident.allowedTransitions.find((s) => s === selected);
  const disabled = pending || (!next && !message.trim());

  async function submit() {
    if (disabled) return;
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
    setSelected(null);
    if (next) onStatusChanged(next, note);
  }

  return (
    <div className="flex gap-3">
      <UserAvatar
        name={user ? personName(user) : null}
        src={user?.photoUrl}
        className="size-8 text-xs"
      />
      <Composer>
        <ComposerHeader>
          <ComposerTabs />
          <ComposerHint>Markdown</ComposerHint>
        </ComposerHeader>
        <ComposerTextarea
          placeholder="What's happening? Impact, what you've found, what's next."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit().catch(console.error);
            }
          }}
        />
        <ComposerPreview value={message} />
        <ComposerFooter>
          <div className="flex items-center gap-2">
            <span>Set status to</span>
            <Select
              value={next ?? incident.status}
              onValueChange={(value) =>
                setSelected(value === incident.status ? null : value)
              }
            >
              <SelectTrigger
                size="sm"
                aria-label="Set status to"
                className="bg-background text-foreground font-mono"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[incident.status, ...incident.allowedTransitions].map((s) => (
                  <SelectItem key={s} value={s} className="font-mono">
                    <StatusDot variant={statusConfig[s].variant} />
                    {statusConfig[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs sm:inline">
              Only your team sees notes
            </span>
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => submit().catch(console.error)}
            >
              {next
                ? `Post and mark ${statusConfig[next].label.toLowerCase()}`
                : "Post note"}
            </Button>
          </div>
        </ComposerFooter>
      </Composer>
    </div>
  );
}
