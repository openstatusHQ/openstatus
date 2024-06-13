"use client";

import * as Portal from "@radix-ui/react-portal";
import type { Table } from "@tanstack/react-table";
import { useEffect, useState, useTransition } from "react";

import { Kbd } from "@/components/kbd";
import { LoadingAnimation } from "@/components/loading-animation";
import { toast, toastAction } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { Check, Minus, X } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const rows = table.getFilteredSelectedRowModel().rows;

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
          loading: "Updating monitor(s)...",
          success: "Monitor(s) updated!",
          error: "Something went wrong!",
          finally: () => {},
        },
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
          loading:
            props.action === "add"
              ? "Adding tag to monitor(s)..."
              : "Removing tag from monitor(s)...",
          success:
            props.action === "add"
              ? "Tag added to monitor(s)!"
              : "Tag removed from monitor(s)",
          error: "Something went wrong!",
          finally: () => {},
        },
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

  // TODO: can we make it smarter! Its ugly as hell

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

  const everyTagValue =
    tags?.filter((tag) => {
      return rows.every((row) => {
        const _tags = row.getValue("tags");
        if (Array.isArray(_tags)) {
          return _tags.map(({ id }) => id)?.includes(tag.id);
        }
        return false;
      });
    }) || [];

  const someTagValue =
    tags?.filter((tag) => {
      return rows.some((row) => {
        const _tags = row.getValue("tags");
        if (Array.isArray(_tags)) {
          return _tags.map(({ id }) => id)?.includes(tag.id);
        }
        return false;
      });
    }) || [];

  return (
    <Portal.Root>
      <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-4 py-2 shadow">
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
          <AlertDialog
            open={alertOpen}
            onOpenChange={(value) => setAlertOpen(value)}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-background"
              >
                Delete
              </Button>
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
            <SelectTrigger className="h-9 max-w-fit">
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
          <Popover>
            <PopoverTrigger disabled={isPending && method === "tag"} asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <span>Tags</span>
                {everyTagValue.length ? (
                  <div className="relative flex overflow-hidden">
                    {everyTagValue.map((tag) => (
                      <div
                        key={tag.id}
                        style={{ backgroundColor: tag.color }}
                        className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                      />
                    ))}
                  </div>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder={"Tags"} />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {tags?.map((tag) => {
                      const isSelected = everyTagValue
                        .map((tag) => tag.id)
                        ?.includes(tag.id);
                      const isIndeterminated = !isSelected
                        ? someTagValue.map((tag) => tag.id)?.includes(tag.id)
                        : false;
                      return (
                        <CommandItem
                          key={String(tag.name)}
                          onSelect={() => {
                            setMethod("tag");
                            handleTagUpdates({
                              tagId: tag.id,
                              action:
                                !isSelected || isIndeterminated
                                  ? "add"
                                  : "remove",
                            });
                          }}
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              {
                                "bg-primary text-primary-foreground":
                                  isSelected,
                                "text-muted-foreground": isIndeterminated,
                                "opacity-50 [&_svg]:invisible":
                                  !isSelected && !isIndeterminated,
                              },
                            )}
                          >
                            <Check className={cn("h-4 w-4")} />
                          </div>
                          <div className="flex w-full items-center justify-between">
                            <span>{tag.name}</span>
                            <div
                              key={tag.id}
                              style={{ backgroundColor: tag.color }}
                              className="h-2.5 w-2.5 rounded-full"
                            />
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Select
            disabled={isPending && method === "public"}
            value={visibilityValue}
            onValueChange={(value) => {
              setMethod("public");
              handleUpdates({ public: value === "true" });
            }}
          >
            <SelectTrigger className="h-9 max-w-fit">
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
