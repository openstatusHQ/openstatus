"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import type * as z from "zod";

import type {
  insertMonitorSchema,
  insertPageSchema,
} from "@openstatus/db/src/schema";

import { StatusPageForm } from "@/components/forms/status-page-form";
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

type MonitorSchema = z.infer<typeof insertMonitorSchema>;
type PageSchema = z.infer<typeof insertPageSchema>;

// allMonitors
interface ActionButtonProps {
  page: PageSchema;
  allMonitors?: MonitorSchema[];
}

export function ActionButton({ page, allMonitors }: ActionButtonProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onUpdate({
    monitors,
    ...props
  }: PageSchema & { monitors: string[] }) {
    console.log({ monitors, ...props });
    setSaving(true);
    // await api.monitor.updateMonitor.mutate({ id: props.id, ...values });
    await wait(1000);
    router.refresh();
    setSaving(false);
    setDialogOpen(false);
  }

  async function onDelete() {
    setSaving(true);
    // await api.monitor.deleteMonitor.mutate({ monitorId: Number(props.id) });
    await wait(1000);
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
          <DialogTitle>Update Page</DialogTitle>
          <DialogDescription>Change your settings.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 overflow-y-scroll px-1">
          <StatusPageForm
            id="status-page-update"
            onSubmit={onUpdate}
            defaultValues={page}
            allMonitors={
              allMonitors?.map((m) => ({
                label: m.name || "",
                value: String(m.id) || "",
              })) ?? []
            }
          />
        </div>
        <DialogFooter>
          <Button
            type="submit"
            form="status-page-update"
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
