"use client";

import { Link } from "@/components/common/link";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PopoverContent } from "@/components/ui/popover";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import {
  Check,
  ChevronsUpDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Monitor = {
  id: number;
  name: string;
  url: string;
  active: boolean | null;
};

type MonitorGroup = {
  id: number;
  name: string;
  monitors: Monitor[];
};

const monitorSchema = z.object({
  id: z.number(),
  order: z.number(),
  active: z.boolean().nullable(),
});

const schema = z.object({
  monitors: z.array(monitorSchema),
  groups: z.array(
    z.object({
      id: z.number(),
      order: z.number(),
      name: z.string(),
      monitors: z.array(monitorSchema).min(1, {
        error: "At least one monitor is required",
      }),
    }),
  ),
});

const getSortedMonitors = (
  monitors: Monitor[],
  monitorData: { id: number; order: number }[],
) => {
  const orderMap = new Map(monitorData?.map((m) => [m.id, m.order]) ?? []);

  return monitors
    .filter((monitor) => orderMap.has(monitor.id))
    .sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? 0;
      const bOrder = orderMap.get(b.id) ?? 0;
      return aOrder - bOrder;
    });
};

const getSortedItems = (
  monitors: Monitor[],
  monitorData: { id: number; order: number }[],
  groups: Array<{
    id: number;
    order: number;
    name: string;
    monitors: Array<{ id: number; order: number; active: boolean | null }>;
  }>,
): (Monitor | MonitorGroup)[] => {
  // Create map of monitor orders
  const monitorOrderMap = new Map(monitorData.map((m) => [m.id, m.order]));

  // Create array of monitors with their orders
  const monitorsWithOrder = monitors
    .filter((monitor) => monitorOrderMap.has(monitor.id))
    .map((monitor) => ({
      item: monitor,
      order: monitorOrderMap.get(monitor.id) ?? 0,
    }));

  // Create array of groups with their orders
  const groupsWithOrder = groups.map((group) => ({
    item: {
      id: group.id,
      name: group.name,
      monitors: getSortedMonitors(monitors, group.monitors),
    } as MonitorGroup,
    order: group.order,
  }));

  // Combine and sort by order
  return [...monitorsWithOrder, ...groupsWithOrder]
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.item);
};

type FormValues = z.infer<typeof schema>;

export function FormMonitors({
  defaultValues,
  onSubmit,
  monitors,
  legacy,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  monitors: Monitor[];
  /**
   * Whether the status page is legacy or new
   */
  legacy: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });
  const [isPending, startTransition] = useTransition();
  const watchMonitors = form.watch("monitors");
  const watchGroups = form.watch("groups");
  const [data, setData] = useState<(Monitor | MonitorGroup)[]>(
    getSortedItems(
      monitors,
      defaultValues?.monitors ?? [],
      defaultValues?.groups ?? [],
    ),
  );

  // Get all monitor IDs that are already used in groups
  const monitorsInGroups = new Set(
    (watchGroups ?? []).flatMap((g) => g.monitors.map((m) => m.id)),
  );

  useEffect(() => {
    const sortedItems = getSortedItems(
      monitors,
      watchMonitors,
      watchGroups ?? [],
    );
    setData(sortedItems);
  }, [watchMonitors, watchGroups, monitors]);

  const onValueChange = useCallback(
    (newItems: (Monitor | MonitorGroup)[]) => {
      setData(newItems);

      // Update monitors with their position in the overall list
      const monitors = newItems
        .map((item, index) => ({ item, index }))
        .filter(
          (entry): entry is { item: Monitor; index: number } =>
            "url" in entry.item,
        )
        .map(({ item, index }) => ({
          id: item.id,
          order: index,
          active: item.active,
        }));
      form.setValue("monitors", monitors);

      // Update groups with their position in the overall list
      const existingGroups = form.getValues("groups") ?? [];
      const groups = newItems
        .map((item, index) => ({ item, index }))
        .filter(
          (entry): entry is { item: MonitorGroup; index: number } =>
            "monitors" in entry.item && !("url" in entry.item),
        )
        .map(({ item, index }) => {
          const existingGroup = existingGroups.find((g) => g.id === item.id);
          return existingGroup
            ? {
                ...existingGroup,
                order: index,
              }
            : {
                id: item.id,
                order: index,
                name: item.name,
                monitors: [],
              };
        });
      form.setValue("groups", groups);
    },
    [form],
  );

  const getItemValue = useCallback(
    (item: Monitor | MonitorGroup) => item.id,
    [],
  );

  const handleAddGroup = useCallback(() => {
    const newGroupId = Date.now();
    const existingGroups = form.getValues("groups") ?? [];
    const existingMonitors = form.getValues("monitors") ?? [];
    const order = existingGroups.length + existingMonitors.length;
    const newGroups = [
      ...existingGroups,
      { id: newGroupId, order, name: "", monitors: [] },
    ];
    form.setValue("groups", newGroups);
    setData((prev) => [
      ...prev,
      { id: newGroupId, order, name: "", monitors: [] },
    ]);
  }, [form]);

  const handleDeleteGroup = useCallback(
    (groupId: number) => {
      const existingGroups = form.getValues("groups") ?? [];
      form.setValue(
        "groups",
        existingGroups.filter((g) => g.id !== groupId),
      );
      setData((prev) => prev.filter((item) => item.id !== groupId));
    },
    [form],
  );

  const renderOverlay = useCallback(
    ({ value }: { value: UniqueIdentifier }) => {
      const monitor = data.find((item) => item.id === value);
      if (!monitor) return null;

      if ("url" in monitor) {
        return (
          <MonitorRow
            monitor={monitor}
            form={form}
            className="border-transparent border-x px-2"
          />
        );
      }

      const groups = form.getValues("groups") ?? [];
      const groupIndex = groups.findIndex((g) => g.id === monitor.id);
      return (
        <MonitorGroup
          group={monitor}
          groupIndex={groupIndex}
          onDeleteGroup={handleDeleteGroup}
          form={form}
          monitors={monitors}
        />
      );
    },
    [data, handleDeleteGroup, form, monitors],
  );

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to save";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Monitors</FormCardTitle>
            <FormCardDescription>
              Connect your monitors to your status page.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="monitors"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="sr-only">Monitors</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value.length > 0
                            ? `${field.value.length} monitors selected`
                            : "Select monitors"}
                          <ChevronsUpDown className="opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search monitors..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No monitors found.</CommandEmpty>
                          <CommandGroup>
                            {monitors.map((monitor) => {
                              const isInGroup = monitorsInGroups.has(
                                monitor.id,
                              );
                              const isSelected = field.value.some(
                                (m) => m.id === monitor.id,
                              );
                              return (
                                <CommandItem
                                  value={monitor.name}
                                  key={monitor.id}
                                  disabled={isInGroup}
                                  onSelect={() => {
                                    if (isSelected) {
                                      form.setValue(
                                        "monitors",
                                        field.value.filter(
                                          (m) => m.id !== monitor.id,
                                        ),
                                      );
                                    } else {
                                      form.setValue("monitors", [
                                        ...field.value,
                                        {
                                          id: monitor.id,
                                          order: watchMonitors.length,
                                          active: monitor.active,
                                        },
                                      ]);
                                    }
                                  }}
                                >
                                  {monitor.name}
                                  <Check
                                    className={cn(
                                      "ml-auto",
                                      isSelected ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>Choose monitors to display.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {legacy ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full"
                        disabled={legacy}
                      >
                        <Plus />
                        Add Group
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Enable the new redesign to add groups to your status page.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="outline"
                type="button"
                className="w-full"
                onClick={handleAddGroup}
              >
                <Plus />
                Add Group
              </Button>
            )}
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            <Sortable
              value={data}
              onValueChange={onValueChange}
              getItemValue={getItemValue}
              orientation="vertical"
            >
              {data.length ? (
                <SortableContent className="grid gap-2">
                  {data.map((item) => {
                    if ("url" in item) {
                      return (
                        <MonitorRow
                          key={`${item.id}-monitor`}
                          className="border-transparent border-x px-2"
                          monitor={item}
                          form={form}
                        />
                      );
                    }
                    const groups = form.getValues("groups") ?? [];
                    const groupIndex = groups.findIndex(
                      (g) => g.id === item.id,
                    );
                    return (
                      <MonitorGroup
                        key={`${item.id}-group`}
                        group={item}
                        groupIndex={groupIndex}
                        onDeleteGroup={handleDeleteGroup}
                        form={form}
                        monitors={monitors}
                      />
                    );
                  })}
                  <SortableOverlay>{renderOverlay}</SortableOverlay>
                </SortableContent>
              ) : (
                <EmptyStateContainer>
                  <EmptyStateTitle>No monitors selected</EmptyStateTitle>
                </EmptyStateContainer>
              )}
            </Sortable>
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about monitor <Link href="#">display options</Link>.
            </FormCardFooterInfo>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}

interface MonitorRowProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SortableItem>, "value"> {
  monitor: Monitor;
  form: UseFormReturn<FormValues>;
}

function MonitorRow({ monitor, className, ...props }: MonitorRowProps) {
  return (
    <SortableItem
      value={monitor.id}
      asChild
      className={cn("rounded-md", className)}
      {...props}
    >
      <div className="grid h-9 grid-cols-3 gap-2">
        <div className="flex flex-row items-center gap-4 self-center">
          <SortableItemHandle>
            <GripVertical
              size={16}
              aria-hidden="true"
              className="text-muted-foreground"
            />
          </SortableItemHandle>
          <span className="truncate text-sm">{monitor.name}</span>
        </div>
        <div className="self-center truncate text-muted-foreground text-sm">
          {monitor.url}
        </div>
        <div className="self-center truncate text-muted-foreground text-sm">
          {monitor.active ? "Active" : "Inactive"}
        </div>
      </div>
    </SortableItem>
  );
}

interface MonitorGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SortableItem>, "value"> {
  group: MonitorGroup;
  groupIndex: number;
  onDeleteGroup: (groupId: number) => void;
  form: UseFormReturn<FormValues>;
  monitors: Monitor[];
}

function MonitorGroup({
  group,
  groupIndex,
  onDeleteGroup,
  form,
  monitors,
}: MonitorGroupProps) {
  const watchGroup = form.watch(`groups.${groupIndex}`);
  const watchMonitors = form.watch("monitors");
  const watchGroups = form.watch("groups");
  const [data, setData] = useState<Monitor[]>(group.monitors);

  // Calculate taken monitors (in main list or other groups)
  const takenMonitorIds = new Set([
    ...watchMonitors.map((m) => m.id),
    ...watchGroups
      .filter((g) => g.id !== group.id)
      .flatMap((g) => g.monitors.map((m) => m.id)),
  ]);

  const onValueChange = useCallback(
    (newMonitors: Monitor[]) => {
      setData(newMonitors);
      // Update the form with the new monitor order
      form.setValue(
        `groups.${groupIndex}.monitors`,
        newMonitors.map((m, index) => ({
          id: m.id,
          order: index,
          active: m.active,
        })),
      );
    },
    [form, groupIndex],
  );

  useEffect(() => {
    setData(getSortedMonitors(monitors, watchGroup.monitors));
  }, [watchGroup.monitors, monitors]);

  const getItemValue = useCallback((item: Monitor) => item.id, []);

  const renderOverlay = useCallback(
    ({ value }: { value: UniqueIdentifier }) => {
      const monitor = data.find((item) => item.id === value);
      if (!monitor) return null;

      return <MonitorRow monitor={monitor} form={form} />;
    },
    [data, form],
  );

  return (
    <SortableItem value={group.id} className="rounded-md border bg-muted">
      <div className="grid grid-cols-3 gap-2 px-2 pt-2">
        <div className="flex flex-row items-center gap-1 self-center">
          <SortableItemHandle>
            <GripVertical
              size={16}
              aria-hidden="true"
              className="text-muted-foreground"
            />
          </SortableItemHandle>
          <FormField
            key={`${group.id}-name-${groupIndex}`}
            control={form.control}
            name={`groups.${groupIndex}.name` as const}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="sr-only">Group name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Group Name"
                    className="w-full bg-background"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          key={`${group.id}-monitors-${groupIndex}`}
          control={form.control}
          name={`groups.${groupIndex}.monitors` as const}
          render={({ field }) => (
            <FormItem className="flex w-full flex-col">
              <FormLabel className="sr-only">Monitors</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {Array.isArray(field.value) && field.value.length > 0
                        ? `${field.value.length} monitors selected`
                        : "Select monitors"}
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search monitors..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No monitors found.</CommandEmpty>
                      <CommandGroup>
                        {monitors.map((monitor) => {
                          const current = field.value ?? [];
                          const isSelected = current.some(
                            (m) => m.id === monitor.id,
                          );
                          const isTaken = takenMonitorIds.has(monitor.id);
                          return (
                            <CommandItem
                              value={monitor.name}
                              key={monitor.id}
                              disabled={isTaken}
                              onSelect={() => {
                                if (isSelected) {
                                  form.setValue(
                                    `groups.${groupIndex}.monitors`,
                                    current.filter((m) => m.id !== monitor.id),
                                  );
                                } else {
                                  form.setValue(
                                    `groups.${groupIndex}.monitors`,
                                    [
                                      ...current,
                                      {
                                        id: monitor.id,
                                        order: 0,
                                        active: monitor.active,
                                      },
                                    ],
                                  );
                                }
                              }}
                            >
                              {monitor.name}
                              <Check
                                className={cn(
                                  "ml-auto",
                                  isSelected ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 [&_svg]:size-4 [&_svg]:text-destructive"
                // NOTE: delete directly if no monitors are in the group
                {...(data.length === 0
                  ? { onClick: () => onDeleteGroup(group.id) }
                  : {})}
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to delete this group and all its monitors.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
                  onClick={() => onDeleteGroup(group.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="mt-2 border-t px-2 pt-2 pb-2">
        <Sortable
          value={data}
          onValueChange={onValueChange}
          getItemValue={getItemValue}
          orientation="vertical"
        >
          {data.length ? (
            <SortableContent className="grid gap-2">
              {data.map((item) => {
                return (
                  <MonitorRow
                    key={`${item.id}-monitor`}
                    monitor={item}
                    form={form}
                  />
                );
              })}
              <SortableOverlay>{renderOverlay}</SortableOverlay>
            </SortableContent>
          ) : (
            <EmptyStateContainer>
              <EmptyStateTitle>No monitors selected</EmptyStateTitle>
            </EmptyStateContainer>
          )}
        </Sortable>
      </div>
    </SortableItem>
  );
}
