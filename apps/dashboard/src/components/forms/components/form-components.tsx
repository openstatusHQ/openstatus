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
import { STATUS } from "@/components/nav/nav-monitors";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import type { RouterOutputs } from "@openstatus/api";
import { isTRPCClientError } from "@trpc/client";
import {
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Link2Off,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type PageComponent = RouterOutputs["pageComponent"]["list"][number];
type Monitor = RouterOutputs["monitor"]["list"][number];

type ComponentGroup = {
  id: number;
  name: string;
  components: PageComponent[];
};

const componentSchema = z.object({
  id: z.number(),
  monitorId: z.number().nullish(),
  order: z.number(),
  name: z.string().min(1, { message: "Name is required" }),
  type: z.enum(["monitor", "external"]),
});

const schema = z.object({
  components: z.array(componentSchema),
  groups: z.array(
    z.object({
      id: z.number(),
      order: z.number(),
      name: z.string(),
      components: z.array(componentSchema).min(1, {
        message: "At least one component is required",
      }),
    }),
  ),
});

const getSortedComponents = (
  components: PageComponent[],
  componentData: {
    id: number;
    order: number;
    name?: string;
    type?: "monitor" | "external";
    monitorId?: number | null;
  }[],
  monitors: Monitor[],
) => {
  const orderMap = new Map(componentData?.map((c) => [c.id, c.order]) ?? []);

  // Create a map of existing components
  const componentMap = new Map(components.map((c) => [c.id, c]));

  // Create a map of monitors for lookup
  const monitorMap = new Map(monitors.map((m) => [m.id, m]));

  // Create synthetic components for any in componentData that don't exist in components
  componentData.forEach((c) => {
    if (!componentMap.has(c.id)) {
      // Look up monitor data if this is a monitor component
      const monitor = c.monitorId ? monitorMap.get(c.monitorId) : null;

      // Create synthetic PageComponent
      componentMap.set(c.id, {
        id: c.id,
        name: c.name ?? "",
        type: c.type ?? "external",
        monitorId: c.monitorId ?? null,
        monitor: monitor ?? null,
        groupId: null,
        groupOrder: null,
        order: c.order,
      } as PageComponent);
    }
  });

  return Array.from(componentMap.values())
    .filter((component) => orderMap.has(component.id))
    .sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? 0;
      const bOrder = orderMap.get(b.id) ?? 0;
      return aOrder - bOrder;
    });
};

const getSortedItems = (
  components: PageComponent[],
  componentData: {
    id: number;
    order: number;
    name?: string;
    type?: "monitor" | "external";
    monitorId?: number | null;
  }[],
  groups: Array<{
    id: number;
    order: number;
    name: string;
    components: Array<{
      id: number;
      order: number;
      name?: string;
      type?: "monitor" | "external";
      monitorId?: number | null;
    }>;
  }>,
  monitors: Monitor[],
): (PageComponent | ComponentGroup)[] => {
  // Create map of component orders
  const componentOrderMap = new Map(componentData.map((c) => [c.id, c.order]));

  // Create a map of existing components
  const componentMap = new Map(components.map((c) => [c.id, c]));

  // Create a map of monitors for lookup
  const monitorMap = new Map(monitors.map((m) => [m.id, m]));

  // Create synthetic components for any in componentData that don't exist in components
  componentData.forEach((c) => {
    if (!componentMap.has(c.id)) {
      // Look up monitor data if this is a monitor component
      const monitor = c.monitorId ? monitorMap.get(c.monitorId) : null;

      // Create synthetic PageComponent
      componentMap.set(c.id, {
        id: c.id,
        name: c.name ?? "",
        type: c.type ?? "external",
        monitorId: c.monitorId ?? null,
        monitor: monitor ?? null,
        groupId: null,
        groupOrder: null,
        order: c.order,
      } as PageComponent);
    }
  });

  // Get all enhanced components (including synthetic ones)
  const enhancedComponents = Array.from(componentMap.values());

  // Create array of components with their orders
  const componentsWithOrder = enhancedComponents
    .filter((component) => componentOrderMap.has(component.id))
    .map((component) => ({
      item: component,
      order: componentOrderMap.get(component.id) ?? 0,
    }));

  // Create array of groups with their orders
  const groupsWithOrder = groups.map((group) => ({
    item: {
      id: group.id,
      name: group.name,
      components: getSortedComponents(
        enhancedComponents,
        group.components,
        monitors,
      ),
    } as ComponentGroup,
    order: group.order,
  }));

  // Combine and sort by order
  return [...componentsWithOrder, ...groupsWithOrder]
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.item);
};

type FormValues = z.infer<typeof schema>;

export function FormComponents({
  defaultValues,
  onSubmit,
  pageComponents,
  allPageComponents,
  monitors,
  legacy,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  /** Page components available for selection (standalone, not in groups) */
  pageComponents: PageComponent[];
  /** All page components for the page (including those in groups) */
  allPageComponents: PageComponent[];
  /** Monitors available for selection */
  monitors: Monitor[];
  /**
   * Whether the status page is legacy or new
   */
  legacy: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { components: [], groups: [] },
  });
  const [isPending, startTransition] = useTransition();
  const watchComponents = form.watch("components");
  const watchGroups = form.watch("groups");
  const [data, setData] = useState<(PageComponent | ComponentGroup)[]>(
    getSortedItems(
      allPageComponents,
      defaultValues?.components ?? [],
      defaultValues?.groups ?? [],
      monitors,
    ),
  );

  // Get all monitor IDs that are already used (in standalone components or groups)
  const usedMonitorIds = new Set([
    ...(watchComponents ?? [])
      .filter((c) => c.monitorId)
      .map((c) => c.monitorId),
    ...(watchGroups ?? [])
      .flatMap((g) => g.components)
      .filter((c) => c.monitorId)
      .map((c) => c.monitorId),
  ]);

  useEffect(() => {
    const sortedItems = getSortedItems(
      allPageComponents,
      watchComponents,
      watchGroups ?? [],
      monitors,
    );
    setData(sortedItems);
  }, [watchComponents, watchGroups, allPageComponents, monitors]);

  const onValueChange = useCallback(
    (newItems: (PageComponent | ComponentGroup)[]) => {
      setData(newItems);

      // Update components with their position in the overall list
      const existingComponents = form.getValues("components") ?? [];
      const components = newItems
        .map((item, index) => ({ item, index }))
        .filter(
          (entry): entry is { item: PageComponent; index: number } =>
            "type" in entry.item,
        )
        .map(({ item, index }) => {
          const existingComponent = existingComponents.find(
            (c) => c.id === item.id,
          );
          return {
            id: item.id,
            monitorId: item.monitorId,
            order: index,
            name: existingComponent?.name ?? item.name,
            type: item.type,
          };
        });
      form.setValue("components", components);

      // Update groups with their position in the overall list
      const existingGroups = form.getValues("groups") ?? [];
      const groups = newItems
        .map((item, index) => ({ item, index }))
        .filter(
          (entry): entry is { item: ComponentGroup; index: number } =>
            "components" in entry.item && !("type" in entry.item),
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
                components: [],
              };
        });
      form.setValue("groups", groups);
    },
    [form],
  );

  const getItemValue = useCallback(
    (item: PageComponent | ComponentGroup) => item.id,
    [],
  );

  const handleAddGroup = useCallback(() => {
    const newGroupId = Date.now();
    const existingGroups = form.getValues("groups") ?? [];
    const existingComponents = form.getValues("components") ?? [];
    const order = existingGroups.length + existingComponents.length;
    const newGroups = [
      ...existingGroups,
      { id: newGroupId, order, name: "", components: [] },
    ];
    form.setValue("groups", newGroups);
    setData((prev) => [...prev, { id: newGroupId, name: "", components: [] }]);
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

  const handleDeleteComponent = useCallback(
    (componentId: number) => {
      const existingComponents = form.getValues("components") ?? [];
      form.setValue(
        "components",
        existingComponents.filter((c) => c.id !== componentId),
      );
      setData((prev) => prev.filter((item) => item.id !== componentId));
    },
    [form],
  );

  const renderOverlay = useCallback(
    ({ value }: { value: UniqueIdentifier }) => {
      const index = data.findIndex((item) => item.id === value);
      if (index === -1) return null;
      const item = data[index];

      if ("type" in item) {
        return (
          <ComponentRow
            component={item}
            form={form}
            className="border-transparent border-x px-2"
            onDelete={handleDeleteComponent}
            // FIXME: this is used to show an input instead of the name when dragging a component
            // fieldNamePrefix={`components.${index}`}
          />
        );
      }

      const groups = form.getValues("groups") ?? [];
      const groupIndex = groups.findIndex((g) => g.id === item.id);
      return (
        <ComponentGroupRow
          group={item}
          groupIndex={groupIndex}
          onDeleteGroup={handleDeleteGroup}
          form={form}
          allPageComponents={allPageComponents}
          monitors={monitors}
        />
      );
    },
    [
      data,
      handleDeleteGroup,
      form,
      allPageComponents,
      monitors,
      handleDeleteComponent,
    ],
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

  console.log(data, form.getValues());

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Components</FormCardTitle>
            <FormCardDescription>
              Manage your page components
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="components"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="sr-only">Components</FormLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Plus />
                        Add Component
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[var(--radix-dropdown-menu-trigger-width)]"
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => {
                            form.setValue("components", [
                              ...field.value,
                              {
                                id: Date.now(),
                                monitorId: null,
                                order: watchComponents.length,
                                name: "",
                                type: "external" as const,
                              },
                            ]);
                          }}
                        >
                          <Link2Off className="text-muted-foreground" />
                          Add External
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0">
                            <Link2 className="text-muted-foreground" />
                            Add Monitor
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search monitors..."
                                className="h-9"
                              />
                              <CommandList>
                                <CommandEmpty>No monitors found.</CommandEmpty>
                                <CommandGroup>
                                  {monitors.map((monitor) => {
                                    const isUsed = usedMonitorIds.has(
                                      monitor.id,
                                    );
                                    const isSelected = field.value.some(
                                      (c) => c.monitorId === monitor.id,
                                    );
                                    return (
                                      <CommandItem
                                        value={monitor.name}
                                        key={monitor.id}
                                        disabled={isUsed}
                                        onSelect={() => {
                                          if (isSelected) {
                                            form.setValue(
                                              "components",
                                              field.value.filter(
                                                (c) =>
                                                  c.monitorId !== monitor.id,
                                              ),
                                            );
                                          } else {
                                            form.setValue("components", [
                                              ...field.value,
                                              {
                                                id: Date.now(),
                                                monitorId: monitor.id,
                                                order: watchComponents.length,
                                                name: monitor.name,
                                                type: "monitor" as const,
                                              },
                                            ]);
                                          }
                                        }}
                                      >
                                        {monitor.name}
                                        <Check
                                          className={cn(
                                            "ml-auto",
                                            isSelected
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={handleAddGroup}
            >
              <Plus />
              Add Component Group
            </Button>
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
                    if ("type" in item) {
                      const components = form.getValues("components") ?? [];
                      const componentIndex = components.findIndex(
                        (c) => c.id === item.id,
                      );
                      return (
                        <ComponentRow
                          key={`${item.id}-component`}
                          className="border-transparent border-x px-2"
                          component={item}
                          form={form}
                          onDelete={handleDeleteComponent}
                          fieldNamePrefix={
                            componentIndex >= 0
                              ? `components.${componentIndex}`
                              : undefined
                          }
                        />
                      );
                    }
                    const groups = form.getValues("groups") ?? [];
                    const groupIndex = groups.findIndex(
                      (g) => g.id === item.id,
                    );
                    return (
                      <ComponentGroupRow
                        key={`${item.id}-group`}
                        group={item}
                        groupIndex={groupIndex}
                        onDeleteGroup={handleDeleteGroup}
                        form={form}
                        allPageComponents={allPageComponents}
                        monitors={monitors}
                      />
                    );
                  })}
                  <SortableOverlay>{renderOverlay}</SortableOverlay>
                </SortableContent>
              ) : (
                <EmptyStateContainer>
                  <EmptyStateTitle>No components selected</EmptyStateTitle>
                </EmptyStateContainer>
              )}
            </Sortable>
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about <Link href="#">page components</Link>.
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

interface ComponentRowProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SortableItem>, "value"> {
  component: PageComponent;
  form: UseFormReturn<FormValues>;
  onDelete: (componentId: number) => void;
  /** The form field name prefix, e.g. "components.0" or "groups.0.components.1" */
  fieldNamePrefix?: string;
}

function ComponentRow({
  component,
  className,
  onDelete,
  form,
  fieldNamePrefix,
  ...props
}: ComponentRowProps) {
  return (
    <SortableItem
      value={component.id}
      asChild
      className={cn("rounded-md", className)}
      {...props}
    >
      <div className="grid h-9 grid-cols-3 gap-2">
        <div className="flex flex-row items-center gap-1 self-center">
          <SortableItemHandle>
            <GripVertical
              size={16}
              aria-hidden="true"
              className="text-muted-foreground"
            />
          </SortableItemHandle>
          {fieldNamePrefix ? (
            <FormField
              control={form.control}
              name={`${fieldNamePrefix}.name` as "components.0.name"}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="sr-only">Component name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Component Name"
                      className="w-full bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <span className="truncate rounded-md border border-transparent px-3 py-1 text-sm">
              {component.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 self-center text-muted-foreground text-sm">
          {component.monitor && component.type === "monitor" ? (
            <Link
              href={`/monitors/${component.monitorId}/overview`}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 truncate text-sm"
            >
              <Link2 className="size-4 shrink-0" />{" "}
              <span className="truncate">{component.monitor.name}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <Link2Off className="size-4 shrink-0" />{" "}
              <span className="truncate">External Component</span>
            </span>
          )}
        </div>
        <div className="flex justify-between">
          <div className="flex flex-1 items-center gap-2.5">
            {component.monitor && component.type === "monitor" ? (
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={0}>
                  {component.monitor.public ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Eye className="size-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Public</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger>
                        <EyeOff className="size-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Private</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            ) : null}
            {component.monitor && component.type === "monitor" ? (
              <div
                className={cn(
                  "size-2 rounded-full",
                  STATUS[
                    component.monitor.active
                      ? component.monitor.status
                      : "inactive"
                  ],
                )}
              />
            ) : null}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 [&_svg]:size-4 [&_svg]:text-destructive"
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to delete this group and all its components.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
                  onClick={() => onDelete(component.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SortableItem>
  );
}

interface ComponentGroupRowProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SortableItem>, "value"> {
  group: ComponentGroup;
  groupIndex: number;
  onDeleteGroup: (groupId: number) => void;
  form: UseFormReturn<FormValues>;
  allPageComponents: PageComponent[];
  monitors: Monitor[];
}

function ComponentGroupRow({
  group,
  groupIndex,
  onDeleteGroup,
  form,
  allPageComponents,
  monitors,
}: ComponentGroupRowProps) {
  const watchGroup = form.watch(`groups.${groupIndex}`);
  const watchComponents = form.watch("components");
  const watchGroups = form.watch("groups");
  const [data, setData] = useState<PageComponent[]>(group.components);

  // Calculate taken monitor IDs (in main list or other groups)
  const takenMonitorIds = new Set([
    ...watchComponents.filter((c) => c.monitorId).map((c) => c.monitorId),
    ...watchGroups
      .filter((g) => g.id !== group.id)
      .flatMap((g) =>
        g.components.filter((c) => c.monitorId).map((c) => c.monitorId),
      ),
  ]);

  // FIXME: order is not being updated in the form
  const onValueChange = useCallback(
    (newComponents: PageComponent[]) => {
      setData(newComponents);
      // Update the form with the new component order
      const existingComponents =
        form.getValues(`groups.${groupIndex}.components`) ?? [];
      form.setValue(
        `groups.${groupIndex}.components`,
        newComponents.map((c, index) => {
          const existingComponent = existingComponents.find(
            (ec) => ec.id === c.id,
          );
          return {
            id: c.id,
            monitorId: c.monitorId,
            order: index,
            name: existingComponent?.name ?? c.name,
            type: c.type,
          };
        }),
      );
    },
    [form, groupIndex],
  );

  useEffect(() => {
    setData(
      getSortedComponents(allPageComponents, watchGroup.components, monitors),
    );
  }, [watchGroup.components, allPageComponents, monitors]);

  const getItemValue = useCallback((item: PageComponent) => item.id, []);

  const handleDeleteComponent = useCallback(
    (componentId: number) => {
      const existingComponents =
        form.getValues(`groups.${groupIndex}.components`) ?? [];
      form.setValue(
        `groups.${groupIndex}.components`,
        existingComponents.filter((c) => c.id !== componentId),
      );
      setData((prev) => prev.filter((item) => item.id !== componentId));
    },
    [form, groupIndex],
  );

  const renderOverlay = useCallback(
    ({ value }: { value: UniqueIdentifier }) => {
      const component = data.find((item) => item.id === value);
      if (!component) return null;

      return (
        <ComponentRow
          component={component}
          form={form}
          onDelete={handleDeleteComponent}
        />
      );
    },
    [data, form, handleDeleteComponent],
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
          key={`${group.id}-components-${groupIndex}`}
          control={form.control}
          name={`groups.${groupIndex}.components` as const}
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="sr-only">Components</FormLabel>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus />
                    Add Component
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => {
                        const current = field.value ?? [];
                        form.setValue(`groups.${groupIndex}.components`, [
                          ...current,
                          {
                            id: Date.now(),
                            monitorId: null,
                            order: current.length,
                            name: "",
                            type: "external" as const,
                          },
                        ]);
                      }}
                    >
                      <Link2Off className="text-muted-foreground" />
                      Add External
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0">
                        <Link2 className="text-muted-foreground" />
                        Add Monitor
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="p-0">
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
                                const isTaken = takenMonitorIds.has(monitor.id);
                                const isSelected = current.some(
                                  (c) => c.monitorId === monitor.id,
                                );
                                return (
                                  <CommandItem
                                    value={monitor.name}
                                    key={monitor.id}
                                    disabled={isTaken}
                                    onSelect={() => {
                                      if (isSelected) {
                                        form.setValue(
                                          `groups.${groupIndex}.components`,
                                          current.filter(
                                            (c) => c.monitorId !== monitor.id,
                                          ),
                                        );
                                      } else {
                                        form.setValue(
                                          `groups.${groupIndex}.components`,
                                          [
                                            ...current,
                                            {
                                              id: Date.now(),
                                              monitorId: monitor.id,
                                              order: current.length,
                                              name: monitor.name,
                                              type: "monitor" as const,
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
                                        isSelected
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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
                // NOTE: delete directly if no components are in the group
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
                  You are about to delete this group and all its components.
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
              {data.map((item, _index) => {
                const groupComponents =
                  form.getValues(`groups.${groupIndex}.components`) ?? [];
                const componentIndex = groupComponents.findIndex(
                  (c) => c.id === item.id,
                );
                return (
                  <ComponentRow
                    key={`${item.id}-component`}
                    component={item}
                    form={form}
                    onDelete={handleDeleteComponent}
                    fieldNamePrefix={
                      componentIndex >= 0
                        ? `groups.${groupIndex}.components.${componentIndex}`
                        : undefined
                    }
                  />
                );
              })}
              <SortableOverlay>{renderOverlay}</SortableOverlay>
            </SortableContent>
          ) : (
            <EmptyStateContainer>
              <EmptyStateTitle>No components selected</EmptyStateTitle>
            </EmptyStateContainer>
          )}
        </Sortable>
      </div>
    </SortableItem>
  );
}
