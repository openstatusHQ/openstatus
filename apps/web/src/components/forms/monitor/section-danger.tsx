"use client";

import React from "react";
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
  Button,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import { SectionHeader } from "../shared/section-header";

interface Props {
  monitorId: number;
}

export function SectionDanger({ monitorId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  async function onDelete() {
    startTransition(async () => {
      try {
        await api.monitor.delete.mutate({ id: monitorId });
        toastAction("deleted");
        router.refresh();
        setOpen(false);
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Danger Zone"
        description="This action cannot be undone. This will permanently delete the monitor."
      />
      <div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full sm:w-auto">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                monitor.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {!isPending ? "Delete" : <LoadingAnimation />}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
