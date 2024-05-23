"use client";

import { CheckIcon, ChevronsUpDown, GripVertical } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type { InsertPage, Monitor } from "@openstatus/db/src/schema";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Sortable,
  SortableDragHandle,
  SortableItem,
} from "@openstatus/ui";

import { StatusDot } from "@/components/monitor/status-dot";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../shared/section-header";

interface Props {
  monitors?: Monitor[];
  form: UseFormReturn<InsertPage>;
}

export function SectionMonitor({ form, monitors }: Props) {
  const [open, setOpen] = useState(false);
  const { fields, append, move, remove } = useFieldArray({
    control: form.control,
    name: "monitors",
  });
  const watchMonitors = form.watch("monitors");

  console.log("fields", fields.length);
  console.log("monitors", monitors);

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Connected Monitors"
        description="Select the monitors you want to display on your status page. Change the order by using the right-side handle. Inactive monitors will not be shown."
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[240px] justify-between"
          >
            {watchMonitors.length > 0
              ? `${watchMonitors.length} monitor${
                  watchMonitors.length > 1 ? "s" : ""
                } selected`
              : "Select monitors..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" className="w-[240px] p-0">
          <Command>
            <CommandInput placeholder="Select monitors..." className="h-9" />
            <CommandEmpty>No monitors found.</CommandEmpty>
            <CommandGroup>
              {monitors?.map((monitor) => (
                <CommandItem
                  key={monitor.id}
                  value={String(monitor.id)}
                  onSelect={(currentValue) => {
                    const monitorIndex = watchMonitors.findIndex(
                      (m) => m.monitorId === Number.parseInt(currentValue),
                    );
                    if (monitorIndex !== -1) {
                      remove(monitorIndex);
                    } else {
                      append({
                        monitorId: monitor.id,
                        order: fields.length + 1,
                      });
                    }
                  }}
                >
                  <div className="truncate">
                    <p>{monitor.name}</p>
                    {/* <p className="text-muted-foreground truncate text-xs">
                      {monitor.url}
                    </p> */}
                  </div>
                  <CheckIcon
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0",
                      watchMonitors.some((m) => m.monitorId === monitor.id)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="h-full w-full">
        {/* FIXME: if we wanna use `overlay` we need to fix the scrollable/position-fixed issues */}
        <Sortable
          value={fields}
          onMove={({ activeIndex, overIndex }) => move(activeIndex, overIndex)}
          // overlay={
          //   <div className="grid grid-cols-[0.5fr,1fr,auto] items-center gap-2">
          //     <Skeleton className="h-8 w-full rounded-sm" />
          //     <Skeleton className="h-8 w-full rounded-sm" />
          //     <Skeleton className="size-8 shrink-0 rounded-sm" />
          //   </div>
          // }
        >
          <div className="w-full space-y-2">
            {fields.map((field) => {
              const monitor = monitors?.find(
                ({ id }) => field.monitorId === id,
              );
              if (!monitor) return null;
              return (
                <SortableItem key={field.id} value={field.id} asChild>
                  <div className="grid grid-cols-[0.5fr,1fr,auto] items-center gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <StatusDot
                        active={monitor.active}
                        status={monitor.status}
                      />{" "}
                      <span className="truncate">{monitor.name}</span>
                    </div>
                    <div className="truncate text-muted-foreground">
                      {monitor?.url}
                    </div>
                    <SortableDragHandle
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      type="button"
                    >
                      <GripVertical className="size-4" aria-hidden="true" />
                    </SortableDragHandle>
                  </div>
                </SortableItem>
              );
            })}
          </div>
        </Sortable>
      </div>
    </div>
  );
}
