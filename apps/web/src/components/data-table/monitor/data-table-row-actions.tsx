"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
  buttonVariants,
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
import { cn } from "@/lib/utils";
interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

const alerts = {
  clone: {
    action: {
      variant: "default",
      text: "Clone",
    },
    dialog: {
      title: "Are you absolutely sure?",
      description: "This action cannot be undone. This will clone the monitor.",
    },
  },
  delete: {
    action: {
      text: "Delete",
      variant: "destructive",
    },
    dialog: {
      title: "Are you absolutely sure?",
      description:
        "This action cannot be undone. This will permanently delete the monitor.",
    },
  },
} as const;

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { monitor, isLimitReached } = z
    .object({ monitor: selectMonitorSchema, isLimitReached: z.boolean() })
    .parse(row.original);
  const router = useRouter();
  const [alertType, setAlertType] = useState<"delete" | "clone" | undefined>();
  const [isPending, startTransition] = useTransition();
  const alertOpen = useMemo(() => alertType !== undefined, [alertType]);
  const alert = useMemo(
    () => (alertType ? alerts[alertType] : undefined),
    [alertType]
  );

  async function onDelete() {
    startTransition(async () => {
      try {
        if (!monitor.id) return;
        await api.monitor.delete.mutate({ id: monitor.id });
        toastAction("deleted");
        setAlertType(undefined);
        router.refresh();
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

        toast.success("Monitor cloned!");
        setAlertType(undefined);
        router.push(
          `./monitors/${createdCloneMonitorData.id}/edit?active=true`
        );
      } catch (error) {
        console.log("error", error);
        toastAction("error");
      }
    });
  }

  return (
    <AlertDialog open={alertOpen}>
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
      {alert ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alert.dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alert.dialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAlertType(undefined)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  if (alertType === "delete") onDelete();
                  else if (alertType === "clone") onClone();
                }}
                disabled={isPending}
                variant={alert.action.variant}
              >
                {!isPending ? alert.action.text : <LoadingAnimation />}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
