"use client";

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
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { toast } from "sonner";

/** Stays open on error so the archive can be retried. */
export function DialogArchiveMonitorSlaPolicy({
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<unknown>;
}) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const promise = onConfirm();
      toast.promise(promise, {
        loading: "Archiving...",
        success: "Archived",
        error: (error) =>
          isTRPCClientError(error) ? error.message : "Failed to archive",
      });
      try {
        await promise;
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to archive:", error);
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
          <AlertDialogTitle>Archive `{name}`?</AlertDialogTitle>
          <AlertDialogDescription>
            It has sealed months, so it is kept as a record instead of being
            deleted. An archived policy is read-only, seals no more months and
            only shows under the archived filter. This cannot be undone.
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
            {isPending ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
