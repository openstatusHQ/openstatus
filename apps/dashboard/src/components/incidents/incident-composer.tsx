"use client";

import type { IncidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import {
  Composer,
  ComposerActions,
  ComposerFooter,
  ComposerPreview,
  ComposerPreviewToggle,
  ComposerSubmit,
  ComposerTextarea,
  useComposerDraft,
} from "@/components/content/composer";
import { TimelineItem } from "@/components/content/timeline";
import { statusConfig } from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { ConfirmCloseDialog } from "./confirm-close-dialog";
import { useInvalidateIncident } from "./use-invalidate-incident";

/**
 * Posting with the status unchanged adds a note; picking a new status moves
 * the incident and carries the text on the same timeline event.
 *
 * Rendered as the head item of the timeline so the rail runs from the avatar
 * down to the latest event.
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
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useComposerDraft(`incident:${incident.id}`);
  const [confirmCancel, setConfirmCancel] = useState(false);

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
  const label = next
    ? `Post and mark ${statusConfig[next].label.toLowerCase()}`
    : "Post note";

  // Canceling closes the incident for good; route through the dialog first.
  function requestSubmit() {
    if (disabled) return;
    if (next === "canceled") setConfirmCancel(true);
    else submit().catch(console.error);
  }

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
      error: (error) => errorMessage(error, "Failed to post"),
    });
    await promise;
    setConfirmCancel(false);
    setMessage("");
    setSelected(null);
    if (next) onStatusChanged(next, note);
  }

  return (
    <TimelineItem>
      <ConfirmCloseDialog
        kind="cancel"
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        pending={pending}
        onConfirm={() => submit().catch(console.error)}
      />
      <Composer className="col-span-full">
        <ComposerTextarea
          placeholder="What's happening? Impact, what you've found, what's next."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onSubmit={requestSubmit}
        />
        <ComposerPreview value={message} />
        <ComposerFooter>
          {/* Shows the current status; picking another one moves the incident. */}
          <Select
            value={next ?? incident.status}
            onValueChange={(value) =>
              setSelected(value === incident.status ? null : value)
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Status"
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
          <ComposerActions>
            <span className="hidden text-xs sm:inline">
              Only your team sees notes
            </span>
            <ComposerPreviewToggle />
            <ComposerSubmit
              label={label}
              disabled={disabled}
              onClick={requestSubmit}
            />
          </ComposerActions>
        </ComposerFooter>
      </Composer>
    </TimelineItem>
  );
}
