"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { z } from "zod";

import { selectMonitorSchema } from "@openstatus/db/src/schema";
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

import type { RegionChecker } from "@/app/play/checker/[id]/utils";
import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";
import { api } from "@/trpc/client";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { monitor } = z
    .object({ monitor: selectMonitorSchema })
    .parse(row.original);
  const router = useRouter();
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  async function onDelete() {
    startTransition(async () => {
      try {
        if (!monitor.id) return;
        await api.monitor.delete.mutate({ id: monitor.id });
        toast("deleted");
        router.refresh();
        setAlertOpen(false);
      } catch {
        toast("error");
      }
    });
  }

  async function onToggleActive() {
    startTransition(async () => {
      try {
        const { jobType, ...rest } = monitor;
        if (!monitor.id) return;
        await api.monitor.update.mutate({
          ...rest,
          active: !monitor.active,
        });
        toast("success");
        router.refresh();
      } catch {
        toast("error");
      }
    });
  }

  async function onTest() {
    startTransition(async () => {
      const { url, body, method, headers } = monitor;

      try {
        const res = await fetch(`/api/checker/test`, {
          method: "POST",
          headers: new Headers({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ url, body, method, headers }),
        });
        const data = (await res.json()) as RegionChecker;

        if (data.status >= 200 && data.status < 300) {
          toast("test-success");
        } else {
          toast("test-error");
        }
      } catch {
        toast("error");
      }
    });
  }

  return (
    <AlertDialog open={alertOpen} onOpenChange={(value) => setAlertOpen(value)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-accent h-8 w-8 p-0"
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Link href={`./monitors/${monitor.id}/edit`}>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </Link>
          <Link href={`./monitors/${monitor.id}/overview`}>
            <DropdownMenuItem>Details</DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onTest}>Test endpoint</DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleActive}>
            {monitor.active ? "Pause" : "Resume"} monitor
          </DropdownMenuItem>
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
