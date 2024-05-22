"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { selectIncidentSchema } from "@openstatus/db/src/schema";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const incident = selectIncidentSchema.parse(row.original);
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [alertOpen, setAlertOpen] = React.useState(false);

  async function resolved() {
    startTransition(async () => {
      try {
        if (!incident.id) return;
        await api.incident.resolvedIncident.mutate({ id: incident.id });
        toastAction("success");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  async function acknowledge() {
    startTransition(async () => {
      try {
        if (!incident.id) return;
        await api.incident.acknowledgeIncident.mutate({ id: incident.id });
        toastAction("success");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  async function onDelete() {
    startTransition(async () => {
      try {
        if (!incident.id) return;
        await api.incident.delete.mutate({ id: incident.id });
        toastAction("success");
        setAlertOpen(false);
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <AlertDialog open={alertOpen} onOpenChange={(value) => setAlertOpen(value)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 data-[state=open]:bg-accent"
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={incident.acknowledgedAt !== null}
            onClick={acknowledge}
          >
            Acknowledge
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              incident.resolvedAt !== null || incident.acknowledgedAt === null
            }
            onClick={resolved}
          >
            Resolved
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Link href={`./incidents/${incident.id}/overview`}>
            <DropdownMenuItem>Details</DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
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
  );
}
