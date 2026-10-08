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

export type ConfirmCloseKind = "cancel" | "close";

const COPY: Record<
  ConfirmCloseKind,
  { title: string; description: string; action: string }
> = {
  cancel: {
    title: "Cancel this incident?",
    description:
      "Marks it as a false alarm and closes it. Status, severity, commander and notes can't be changed afterwards.",
    action: "Cancel incident",
  },
  close: {
    title: "Close this incident?",
    description:
      "Closing is final. Status, severity, commander and notes can't be changed afterwards.",
    action: "Close incident",
  },
};

/**
 * Guards the two transitions that freeze an incident (cancel, close).
 * Resolving is reversible and intentionally not guarded.
 */
export function ConfirmCloseDialog({
  kind,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  kind: ConfirmCloseKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const copy = COPY[kind];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // Opened from a Select; body stays unclickable without this.
          event.preventDefault();
          document.body.style.pointerEvents = "";
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
