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
import { PopoverContent } from "@/components/ui/popover";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import { cn } from "@/lib/utils";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, GripVertical } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// TODO: add type selection + reordering

type Monitor = {
  id: number;
  name: string;
  url: string;
};

const DISABLED_TYPES = ["none"];

const schema = z.object({
  monitors: z.array(
    z.object({
      id: z.number(),
      order: z.number(),
      type: z.enum(["all", "hide", "none"]),
    })
  ),
});

type FormValues = z.infer<typeof schema>;

export function FormMonitors({
  defaultValues,
  onSubmit,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  monitors: Monitor[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<Monitor[]>(() => {
    const orderMap = new Map(
      defaultValues?.monitors.map((m) => [m.id, m.order]) ?? []
    );

    return monitors
      .filter((monitor) => orderMap.has(monitor.id))
      .sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? 0;
        const bOrder = orderMap.get(b.id) ?? 0;
        return aOrder - bOrder;
      });
  });

  const onValueChange = useCallback(
    (newMonitors: Monitor[]) => {
      setData(newMonitors);
      form.setValue(
        "monitors",
        newMonitors.map((m, index) => ({
          id: m.id,
          order: index,
          type: "none" as const,
        }))
      );
    },
    [form]
  );

  const getItemValue = useCallback((item: Monitor) => item.id, []);

  const renderOverlay = useCallback(
    ({ value }: { value: UniqueIdentifier }) => {
      const monitor = data.find((monitor) => monitor.id === value);
      if (!monitor) return null;

      return <MonitorRow monitor={monitor} form={form} />;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => JSON.stringify(values),
          error: "Failed to save",
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
          <FormCardContent>
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
                            "w-[200px] justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          size="sm"
                        >
                          {field.value.length > 0
                            ? `${field.value.length} monitors selected`
                            : "Select monitors"}
                          <ChevronsUpDown className="opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search monitors..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No monitors found.</CommandEmpty>
                          <CommandGroup>
                            {monitors.map((monitor) => (
                              <CommandItem
                                value={monitor.name}
                                key={monitor.id}
                                onSelect={() => {
                                  if (
                                    field.value.some((m) => m.id === monitor.id)
                                  ) {
                                    form.setValue(
                                      "monitors",
                                      field.value.filter(
                                        (m) => m.id !== monitor.id
                                      )
                                    );
                                  } else {
                                    form.setValue("monitors", [
                                      ...field.value,
                                      { id: monitor.id, order: 0, type: "all" },
                                    ]);
                                  }
                                }}
                              >
                                {monitor.name}
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    field.value.some((m) => m.id === monitor.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Select the monitors you want to display on your status page.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            {data.length ? (
              <Sortable
                value={data}
                onValueChange={onValueChange}
                getItemValue={getItemValue}
                orientation="vertical"
              >
                <SortableContent className="grid gap-2">
                  {data.map((monitor) => (
                    <MonitorRow
                      key={monitor.id}
                      monitor={monitor}
                      form={form}
                    />
                  ))}
                  <SortableOverlay>{renderOverlay}</SortableOverlay>
                </SortableContent>
              </Sortable>
            ) : (
              <EmptyStateContainer>
                <EmptyStateTitle>No monitors selected</EmptyStateTitle>
              </EmptyStateContainer>
            )}
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

const types = {
  all: {
    label: "Show all uptime",
  },
  hide: {
    label: "Hide values",
  },
  none: {
    label: "Only status reports",
  },
};

interface MonitorRowProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SortableItem>, "value"> {
  monitor: Monitor;
  form: UseFormReturn<FormValues>;
}

function MonitorRow({ monitor, ...props }: MonitorRowProps) {
  return (
    <SortableItem value={monitor.id} asChild {...props}>
      <div className="grid grid-cols-3 gap-2">
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
        <div>
          <Select>
            <SelectTrigger className="h-7 w-full shadow-none" disabled>
              <SelectValue placeholder="Select type (coming soon)" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(types).map(([key, value]) => (
                <SelectItem
                  key={key}
                  value={key}
                  disabled={DISABLED_TYPES.includes(key)}
                >
                  {value.label}{" "}
                  {DISABLED_TYPES.includes(key) && (
                    <span className="text-foreground text-xs">(Upgrade)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SortableItem>
  );
}
