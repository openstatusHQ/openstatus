"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { Label } from "@openstatus/ui/components/ui/label";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

type Incident = RouterOutputs["monitorIncident"]["list"][number];

/** Excuse a resolved downtime; the reason is required and stays in the dashboard. */
export function DialogExcuseIncident({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const [reason, setReason] = useState("");
  const excuseMutation = useMutation(
    trpc.monitorIncident.excuse.mutationOptions({
      onSuccess: () => {
        // path key: every monitorIncident query (lists and the monitor report)
        queryClient.invalidateQueries({
          queryKey: trpc.monitorIncident.pathKey(),
        });
        toast.success("Downtime excused");
        setReason("");
        onOpenChange(false);
      },
      onError: (error) => toast.error(errorMessage(error, "Failed to excuse")),
    }),
  );
  const canSubmit = reason.trim().length > 0 && !excuseMutation.isPending;
  const submit = () => {
    if (canSubmit) excuseMutation.mutate({ id: incident.id, reason });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excuse downtime</DialogTitle>
          <DialogDescription>
            An excused downtime counts as up in availability and time-based
            uptime, and is hidden from your status pages. Its failed checks
            still count in request and run figures. It stays listed here with
            its reason.
          </DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Label htmlFor={id}>Reason</Label>
          <Textarea
            id={id}
            className="min-h-24"
            value={reason}
            required
            placeholder="Upstream provider outage outside our control"
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={excuseMutation.isPending}
          />
        </form>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={excuseMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={!canSubmit}>
            {excuseMutation.isPending ? "Excusing..." : "Excuse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
