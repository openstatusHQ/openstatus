"use client";

import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";

import { selectInvitationSchema } from "@openstatus/db/src/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const invitation = selectInvitationSchema.parse(row.original);
  const router = useRouter();
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  async function onRevoke() {
    startTransition(async () => {
      try {
        if (!invitation.id) return;
        await api.invitation.delete.mutate({ id: invitation.id });
        toastAction("deleted");
        router.refresh();
        setAlertOpen(false);
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <AlertDialog open={alertOpen} onOpenChange={(value) => setAlertOpen(value)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            The invitation will be revoked and the user will no longer be able
            to join the workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onRevoke();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {!isPending ? "Revoke" : <LoadingAnimation />}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
