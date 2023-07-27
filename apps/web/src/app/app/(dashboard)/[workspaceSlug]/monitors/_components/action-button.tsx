"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import type * as z from "zod";

import type { insertMonitorSchema } from "@openstatus/db/src/schema";

import { MonitorForm } from "@/components/forms/montitor-form";
import { LoadingAnimation } from "@/components/loading-animation";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/client";

type Schema = z.infer<typeof insertMonitorSchema>;

export function ActionButton(props: Schema & { workspaceSlug: string }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  async function onUpdate(values: Schema) {
    startTransition(async () => {
      await api.monitor.updateMonitor.mutate({ ...values });
      router.refresh();
      setDialogOpen(false);
    });
  }

  async function onDelete() {
    startTransition(async () => {
      if (!props.id) return;
      await api.monitor.deleteMonitor.mutate({ id: props.id });
      router.refresh();
      setAlertOpen(false);
    });
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={(value) => setDialogOpen(value)}>
      <AlertDialog
        open={alertOpen}
        onOpenChange={(value) => setAlertOpen(value)}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-accent absolute right-6 top-6 h-8 w-8 p-0"
            >
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DialogTrigger asChild>
              <DropdownMenuItem>Edit</DropdownMenuItem>
            </DialogTrigger>
            <Link
              href={`/app/${props.workspaceSlug}/monitors/${props.id}/data`}
            >
              <DropdownMenuItem>View data</DropdownMenuItem>
            </Link>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-background">
                Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <DialogContent className="flex max-h-screen flex-col">
        <DialogHeader>
          <DialogTitle>Update Monitor</DialogTitle>
          <DialogDescription>Change your settings.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 overflow-y-scroll px-1">
          <MonitorForm
            id="monitor-update"
            onSubmit={onUpdate}
            defaultValues={props}
          />
        </div>
        <DialogFooter>
          <Button
            type="submit"
            form="monitor-update"
            disabled={isPending}
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
