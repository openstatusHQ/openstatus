"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type Incident = RouterOutputs["incident"]["list"][number];

export type IncidentConfirmType = "acknowledge" | "resolve";

/** Controlled acknowledge/resolve confirmation — stays open on error so the action can be retried. */
export function DialogConfirmIncident({
  incident,
  type,
  open,
  onOpenChange,
}: {
  incident: Incident;
  type: IncidentConfirmType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // no-input prefix key — matches every incident.list query (overview, monitor detail)
  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.incident.list.queryKey(),
    });
  const acknowledgeIncidentMutation = useMutation(
    trpc.incident.acknowledge.mutationOptions({ onSuccess: invalidateList }),
  );
  const resolveIncidentMutation = useMutation(
    trpc.incident.resolve.mutationOptions({ onSuccess: invalidateList }),
  );

  const handleConfirm = () => {
    startTransition(async () => {
      const promise =
        type === "acknowledge"
          ? acknowledgeIncidentMutation.mutateAsync({ id: incident.id })
          : resolveIncidentMutation.mutateAsync({ id: incident.id });
      toast.promise(promise, {
        loading: "Confirming...",
        success: "Confirmed",
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "Failed to confirm";
        },
      });
      try {
        await promise;
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to confirm:", error);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // NOTE: bug where the body is not clickable after closing the alert dialog
          event.preventDefault();
          document.body.style.pointerEvents = "";
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm your action</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to <span className="font-semibold">{type}</span> this
            incident.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? "Confirming..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
