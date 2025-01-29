"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

import { LoadingAnimation } from "@/components/loading-animation";
import type { RegionChecker } from "@/components/ping-response-analysis/utils";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

import type { TCPResponse } from "@/app/api/checker/test/tcp/schema";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { monitor, isLimitReached } = z
    .object({ monitor: selectMonitorSchema, isLimitReached: z.boolean() })
    .parse(row.original);
  const router = useRouter();
  const [alertOpen, setAlertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onDelete() {
    startTransition(async () => {
      try {
        if (!monitor.id) return;
        await api.monitor.delete.mutate({ id: monitor.id });
        toastAction("deleted");
        router.refresh();
        setAlertOpen(false);
      } catch {
        toastAction("error");
      }
    });
  }

  // FIXME: the test doenst take the assertions into account!
  // FIXME: improve (similar to the one in the edit form - also include toast.promise + better error message!)
  async function onTest() {
    startTransition(async () => {
      const { url, body, method, headers, jobType } = monitor;

      try {
        const res = await fetch(`/api/checker/test/${jobType}`, {
          method: "POST",
          headers: new Headers({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ url, body, method, headers }),
        });
        const data = (await res.json()) as
          | RegionChecker
          | z.infer<typeof TCPResponse>;

        // FIXME: assertions
        const success =
          data.type === "http"
            ? data.status >= 200 && data.status < 300
            : !data.error;

        if (success) {
          toastAction("test-success");
        } else {
          toastAction("test-error");
        }
      } catch {
        toastAction("error");
      }
    });
  }
  async function onClone() {
    startTransition(async () => {
      try {
        const id = monitor.id;
        if (!id) return;

        const selectedMonitorData = await api.monitor.getMonitorById.query({
          id,
        });

        const { notificationIds, pageIds, monitorTagIds } =
          await api.monitor.getMonitorRelationsById.query({ id });

        const cloneMonitorData = {
          ...selectedMonitorData,
          name: `${selectedMonitorData.name} - copy`,
          tags: monitorTagIds,
          notifications: notificationIds,
          pages: pageIds,
          active: false,
          id: undefined,
          updatedAt: undefined,
          createdAt: undefined,
        };

        // Create a clone function in the api
        await api.monitor.create.mutate(cloneMonitorData);

        toast.success("Monitor cloned!");
        router.refresh();
      } catch (error) {
        console.log("error", error);
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
          <Link href={`./monitors/${monitor.id}/edit`}>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </Link>
          <Link href={`./monitors/${monitor.id}/overview`}>
            <DropdownMenuItem>Details</DropdownMenuItem>
          </Link>
          <DropdownMenuItem onClick={onClone} disabled={isLimitReached}>
            Clone
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTest}>Test</DropdownMenuItem>
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
