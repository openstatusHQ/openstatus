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
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import { getLimit } from "@openstatus/plans";
import * as assertions from "@openstatus/assertions";

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
    // Logic to clone monitor and redirect it to /monitor/[id]/edit
    startTransition(async () => {
      try {
        const id = monitor.id;
        if (!id) return;
        const monitorData = await api.monitor.getMonitorById.query({ id });
        const monitorNotifications =
          await api.monitor.getAllNotificationsForMonitor.query({ id });
        const pages = await api.page.getPagesByWorkspace.query();
        const tags = await api.monitorTag.getMonitorTagsByWorkspace.query();

        const data = {
          ...monitorData,
          // FIXME - Why is this not working?
          degradedAfter: monitorData.degradedAfter ?? undefined,
          pages: pages
            .filter((page) =>
              page.monitorsToPages
                .map(({ monitorId }) => monitorId)
                .includes(id)
            )
            .map(({ id }) => id),
          notifications: monitorNotifications?.map(({ id }) => id),
          tags: tags
            .filter((tag) =>
              tag.monitor.map(({ monitorId }) => monitorId).includes(id)
            )
            .map(({ id }) => id),
        };

        const _assertions = data?.assertions
          ? assertions.deserialize(data?.assertions).map((a) => a.schema)
          : [];
        const defaultValues = {
          url: data?.url || "",
          name: data?.name || "",
          description: data?.description || "",
          periodicity: data?.periodicity || "30m",
          active: data?.active ?? true,
          id: data?.id || 0,
          regions: data?.regions || getLimit("free", "regions"),
          headers: data?.headers?.length
            ? data?.headers
            : [{ key: "", value: "" }],
          body: data?.body ?? "",
          method: data?.method ?? "GET",
          notifications: data?.notifications ?? [],
          pages: data?.pages ?? [],
          tags: data?.tags ?? [],
          public: data?.public ?? false,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          statusAssertions: _assertions.filter(
            (a) => a.type === "status"
          ) as any, // TS considers a.type === "header"
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          headerAssertions: _assertions.filter(
            (a) => a.type === "header"
          ) as any, // TS considers a.type === "status"

          degradedAfter: data?.degradedAfter,
          timeout: data?.timeout || 45000,
        };

        const result = await api.monitor.create.mutate(defaultValues);

        // Navigate user to /monitor/[id]/edit
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
          <Link href={`./monitors/${monitor.id}/edit`}>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </Link>
          <Link href={`./monitors/${monitor.id}/overview`}>
            <DropdownMenuItem>Details</DropdownMenuItem>
          </Link>
          <DropdownMenuItem onClick={onClone}>Clone</DropdownMenuItem>
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
