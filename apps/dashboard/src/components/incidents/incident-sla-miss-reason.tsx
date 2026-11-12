"use client";

import type { IncidentSlaTimerKind } from "@openstatus/db/src/schema/incident_sla_policies/state";
import { Button } from "@openstatus/ui/components/ui/button";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Spinner } from "@openstatus/ui/components/ui/spinner";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateIncident } from "./use-invalidate-incident";

/** Reason under a recorded miss, with a popover to write, edit or clear it. */
export function IncidentSlaMissReason({
  incidentId,
  kind,
  reason,
}: {
  incidentId: number;
  kind: IncidentSlaTimerKind;
  reason: string | null;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateIncident(incidentId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(reason ?? "");
  const save = useMutation(
    trpc.incident.setSlaMissReason.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        setOpen(false);
      },
      onError: (error) => {
        toast.error(errorMessage(error, "Failed to save the reason"));
      },
    }),
  );
  const id = `sla-miss-reason-${kind}`;
  const unchanged = draft.trim() === (reason ?? "");

  function submit() {
    if (unchanged || save.isPending) return;
    save.mutate({ id: incidentId, kind, reason: draft });
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-0.5 pb-1">
      {reason ? (
        <p className="text-foreground font-sans text-xs whitespace-pre-wrap">
          {reason}
        </p>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(reason ?? "");
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-6 px-0 font-sans text-xs"
          >
            {reason ? "Edit reason" : "Explain miss"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-80 flex-col gap-2">
          <Label htmlFor={id}>Why was the {kind} target missed?</Label>
          <Textarea
            id={id}
            rows={4}
            maxLength={2000}
            value={draft}
            placeholder="On-call handover gap, upstream outage, ..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">
              {reason ? "Empty clears it." : "Shown under the target."}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={unchanged || save.isPending}
                onClick={submit}
              >
                {save.isPending ? <Spinner /> : null}
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
