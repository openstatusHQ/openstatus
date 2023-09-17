"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
} from "@openstatus/ui/src/components/alert-dialog";
import { Button } from "@openstatus/ui/src/components/button";

import { LoadingAnimation } from "@/components/loading-animation";
import { useToastAction } from "@/hooks/use-toast-action";
import { revoke } from "./actions";

export function RevokeButton({ keyId }: { keyId: string }) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToastAction();

  async function onRevoke() {
    startTransition(async () => {
      try {
        await revoke(keyId);
        router.refresh();
        setOpen(false);
        toast("deleted");
      } catch {
        toast("error");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(value) => setOpen(value)}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Revoke</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently revoke the API
            key.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await onRevoke();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
          >
            {!isPending ? "Delete" : <LoadingAnimation />}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
