"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
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
import { wait } from "@/lib/utils";
import { api } from "@/trpc/client";

type Schema = z.infer<typeof insertMonitorSchema>;

export function ActionButton(props: Schema) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onUpdate(values: Schema) {
    setSaving(true);
    await api.monitor.updateMonitor.mutate({ ...values });
    router.refresh();
    setSaving(false);
    setDialogOpen(false);
  }

  async function onDelete() {
    if (!props.id) return;
    setSaving(true);
    await api.monitor.deleteMonitor.mutate({ id: props.id });
    router.refresh();
    setSaving(false);
    setAlertOpen(false);
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
            <DropdownMenuItem asChild>
              <Link
                href={`/app/${props.workspaceId}/monitors/${props.id}/data`}
              >
                View data
              </Link>
            </DropdownMenuItem>
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
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {!saving ? "Delete" : <LoadingAnimation />}
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
            disabled={saving}
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {!saving ? "Confirm" : <LoadingAnimation />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
