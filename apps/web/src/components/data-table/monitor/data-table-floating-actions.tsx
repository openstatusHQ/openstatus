"use client";

import { useEffect, useState, useTransition } from "react";
import * as Portal from "@radix-ui/react-portal";
import type { Table } from "@tanstack/react-table";

import type { Monitor, MonitorTag } from "@openstatus/db/src/schema";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { api } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { toast, toastAction } from "@/lib/toast";
import { X } from "lucide-react";
import { Kbd } from "@/components/kbd";
import { LoadingAnimation } from "@/components/loading-animation";

interface DataTableFloatingActions<TData> {
  table: Table<TData>;
  actions?: [];
  tags?: MonitorTag[];
}

export function DataTableFloatingActions<TData>({
  table,
  tags,
}: DataTableFloatingActions<TData>) {
  const router = useRouter();
  const [alertOpen, setAlertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<
    "delete" | "active" | "public" | "tag" | null
  >(null);

  // clear selection on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        table.toggleAllRowsSelected(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [table]);

  const rows = table.getFilteredSelectedRowModel().rows;

  if (table.getFilteredSelectedRowModel().rows.length === 0) {
    return null;
  }

  function handleUpdates(props: Partial<Pick<Monitor, "active" | "public">>) {
    startTransition(async () => {
      toast.promise(
        async () => {
          await api.monitor.updateMonitors.mutate({
            ids: rows.map((row) => row.getValue("id")),
            ...props,
          });
          router.refresh();
        },
        {
          loading: "Updating monitor(s)",
          success: "Monitor(s) updated!",
          error: "Something went wrong!",
          finally: () => {},
        }
      );
    });
  }

  function handleTagUpdates(props: {
    tagId: number;
    action: "add" | "remove";
  }) {
    startTransition(async () => {
      toast.promise(
        async () => {
          await api.monitor.updateMonitorsTag.mutate({
            ids: rows.map((row) => row.getValue("id")),
            ...props,
          });
          router.refresh();
        },
        {
          loading: "Updating monitor(s)",
          success: "Monitor(s) updated!",
          error: "Something went wrong!",
          finally: () => {},
        }
      );
    });
  }

  function handleDeletes() {
    startTransition(async () => {
      try {
        await api.monitor.deleteMonitors.mutate({
          ids: rows.map((row) => row.getValue("id")),
        });
        setAlertOpen(false);
        table.toggleAllRowsSelected(false);
        router.refresh();
      } catch (error) {
        console.error(error);
        toastAction("error");
      }
    });
  }

  // TODO: make it smarter! Its ugly as hell
  const statusValue = rows.every((row) => row.getValue("active") === true)
    ? "true"
    : rows.every((row) => row.getValue("active") === false)
    ? "false"
    : undefined;
  const visibilityValue = rows.every((row) => row.getValue("public") === true)
    ? "true"
    : rows.every((row) => row.getValue("public") === false)
    ? "false"
    : undefined;

  return (
    <Portal.Root>
      <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit px-4">
        <div className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 shadow">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => table.toggleAllRowsSelected(false)}
                  className="border border-dashed"
                >
                  <span className="whitespace-nowrap">
                    {rows.length} selected
                  </span>
                  <X className="ml-1.5 size-4 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="flex items-center">
                <p className="mr-2">Clear selection</p>
                <Kbd abbrTitle="Escape" variant="outline">
                  Esc
                </Kbd>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <AlertDialog
            open={alertOpen}
            onOpenChange={(value) => setAlertOpen(value)}
          >
            <AlertDialogTrigger>
              <Button variant="destructive">Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  selected monitor(s).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setMethod("delete");
                    handleDeletes();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending && method === "delete" ? (
                    <LoadingAnimation />
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Select
            disabled={isPending && method === "active"}
            value={statusValue}
            onValueChange={(value) => {
              setMethod("active");
              handleUpdates({ active: value === "true" });
            }}
          >
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {/* TODO: only update on close! not on every change */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isPending && method === "tag"}
              asChild
            >
              <Button variant="outline">Tags</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {tags?.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={rows.every((row) => {
                    const _tags = row.getValue("tags");
                    if (Array.isArray(_tags)) {
                      return _tags.map(({ id }) => id)?.includes(tag.id);
                    }
                    return false;
                  })}
                  onCheckedChange={(value) => {
                    setMethod("tag");
                    handleTagUpdates({
                      tagId: tag.id,
                      action: value ? "add" : "remove",
                    });
                  }}
                >
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select
            disabled={isPending && method === "public"}
            value={visibilityValue}
            onValueChange={(value) => {
              setMethod("public");
              handleUpdates({ public: value === "true" });
            }}
          >
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Visibility</SelectLabel>
                <SelectItem value="true">Public</SelectItem>
                <SelectItem value="false">Private</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Portal.Root>
  );
}
