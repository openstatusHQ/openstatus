"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
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
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";
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
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertType, setAlertType] = React.useState<"delete" | "clone" | "">("");
  const [isPending, startTransition] = React.useTransition();

  async function onDelete() {
    startTransition(async () => {
      try {
        if (!monitor.id) return;
        await api.monitor.delete.mutate({ id: monitor.id });
        toastAction("deleted");
        router.refresh();
        setAlertOpen(false);
        setAlertType("");
      } catch {
        toastAction("error");
      }
    });
  }

  // FIXME: the test doenst take the assertions into account!
  // FIXME: improve (similar to the one in the edit form - also include toast.promise + better error message!)
  async function onTest() {
    startTransition(async () => {
      const { url, body, method, headers } = monitor;

      try {
        const res = await fetch("/api/checker/test", {
          method: "POST",
          headers: new Headers({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ url, body, method, headers }),
        });
        const data = (await res.json()) as RegionChecker;

        if (data.status >= 200 && data.status < 300) {
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

        const createdCloneMonitorData =
          await api.monitor.create.mutate(cloneMonitorData);

        router.push(
          `./monitors/${createdCloneMonitorData.id}/edit?active=true`,
        );
        toast.success("Monitor cloned!");
        setAlertOpen(false);
        setAlertType("");
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
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onClick={() => setAlertType("clone")}
              disabled={isLimitReached}
            >
              Clone
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <DropdownMenuItem onClick={onTest}>Test</DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onClick={() => setAlertType("delete")}
              className="text-destructive focus:bg-destructive focus:text-background"
            >
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            {alertType === "delete"
              ? "This action cannot be undone. This will permanently delete the monitor."
              : "This action cannot be undone. This will clone the monitor."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (alertType === "delete") onDelete();
              else if (alertType === "clone") onClone();
            }}
            disabled={isPending}
            className={cn({
              "bg-destructive text-destructive-foreground hover:bg-destructive/90":
                alertType === "delete",
              "bg-primary text-primary-foreground hover:bg-primary/90":
                alertType === "clone",
            })}
          >
            {!isPending ? (
              alertType === "delete" ? (
                "Delete"
              ) : alertType === "clone" ? (
                "Clone"
              ) : (
                ""
              )
            ) : (
              <LoadingAnimation />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
