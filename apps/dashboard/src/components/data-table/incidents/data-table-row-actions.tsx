"use client";

import type { Row } from "@tanstack/react-table";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getActions } from "@/data/incidents.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type Incident = RouterOutputs["incident"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Incident>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const acknowledgeIncidentMutation = useMutation(
    trpc.incident.acknowledge.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.incident.list.queryKey({
            monitorId: row.original.monitorId,
          }),
        });
      },
    }),
  );
  const resolveIncidentMutation = useMutation(
    trpc.incident.resolve.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.incident.list.queryKey({
            monitorId: row.original.monitorId,
          }),
        });
      },
    }),
  );
  const deleteIncidentMutation = useMutation(
    trpc.incident.delete.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.incident.list.queryKey({
            monitorId: row.original.monitorId,
          }),
        });
      },
    }),
  );

  const [type, setType] = useState<"acknowledge" | "resolve" | null>(null);
  const open = useMemo(() => type !== null, [type]);

  const actions = getActions({
    acknowledge: row.original.acknowledgedAt
      ? undefined
      : () => setType("acknowledge"),
    resolve: row.original.resolvedAt ? undefined : () => setType("resolve"),
  });

  const handleConfirm = async () => {
    try {
      startTransition(async () => {
        const promise =
          type === "acknowledge"
            ? acknowledgeIncidentMutation.mutateAsync({
                id: row.original.id,
              })
            : resolveIncidentMutation.mutateAsync({
                id: row.original.id,
              });
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
        await promise;
        setType(null);
      });
    } catch (error) {
      console.error("Failed to confirm:", error);
    }
  };

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Incident",
          confirmationValue: "delete incident",
          submitAction: async () => {
            await deleteIncidentMutation.mutateAsync({
              id: row.original.id,
            });
          },
        }}
      />
      <AlertDialog open={open} onOpenChange={() => setType(null)}>
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
              You are about to <span className="font-semibold">{type}</span>{" "}
              this incident.
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
    </>
  );
}
