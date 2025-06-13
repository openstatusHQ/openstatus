"use client";

import type { Row } from "@tanstack/react-table";

import { getActions } from "@/data/incidents.client";
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
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>
) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<"acknowledge" | "resolve" | null>(null);
  const open = useMemo(() => type !== null, [type]);

  const actions = getActions({
    acknowledge: () => setType("acknowledge"),
    resolve: () => setType("resolve"),
  });

  const handleConfirm = async () => {
    try {
      startTransition(async () => {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        toast.promise(promise, {
          loading: "Confirming...",
          success: "Confirmed",
          error: "Failed to confirm",
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
