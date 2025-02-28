"use client";

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
  FormDescription,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import React from "react";
import { SectionHeader } from "../shared/section-header";

interface Props {
  pageId: number;
}

export function SectionDanger({ pageId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  async function onDelete() {
    startTransition(async () => {
      try {
        await api.page.delete.mutate({ id: pageId });
        toastAction("deleted");
        setOpen(false);
        router.push("../");
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Danger Zone"
        description="Be aware of the changes you are about to make."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="col-start-1 flex flex-col items-center gap-4 sm:col-span-2 sm:flex-row">
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
                  status page.
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
          <FormDescription className="order-1 text-red-500 sm:order-2">
            This action cannot be undone. This will permanently delete the
            status page.
          </FormDescription>
        </div>
      </div>
    </div>
  );
}
