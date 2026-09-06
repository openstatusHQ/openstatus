"use client";

import {
  Sortable,
  SortableDragHandle,
  SortableItem,
} from "@openstatus/ui/components/custom/sortable";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { cn } from "@openstatus/ui/lib/utils";
import { Check, GripVertical, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

export function DataTableViewOptions() {
  const { table, enableColumnOrdering } = useDataTable();
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const [search, setSearch] = useState("");

  const columnOrder = table.getState().columnOrder;

  const sortedColumns = useMemo(
    () =>
      table.getAllColumns().sort((a, b) => {
        return columnOrder.indexOf(a.id) - columnOrder.indexOf(b.id);
      }),
    [columnOrder, table],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          role="combobox"
          aria-expanded={open}
          className="shadow-none"
        >
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">View</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[200px] p-0">
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search options..."
          />
          <CommandList>
            <CommandEmpty>No option found.</CommandEmpty>
            <CommandGroup>
              <Sortable
                value={sortedColumns.map((c) => ({ id: c.id }))}
                onValueChange={(items) =>
                  table.setColumnOrder(items.map((c) => c.id))
                }
                overlay={<div className="bg-muted/60 h-8 w-full rounded-md" />}
                onDragStart={() => setDrag(true)}
                onDragEnd={() => setDrag(false)}
                onDragCancel={() => setDrag(false)}
              >
                {sortedColumns
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" &&
                      column.getCanHide(),
                  )
                  .map((column) => (
                    <SortableItem key={column.id} value={column.id} asChild>
                      <CommandItem
                        value={column.id}
                        onSelect={() =>
                          column.toggleVisibility(!column.getIsVisible())
                        }
                        className={"capitalize"}
                        disabled={drag}
                      >
                        <div
                          className={cn(
                            "border-foreground! flex h-4 w-4 items-center justify-center rounded-sm border",
                            column.getIsVisible()
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <Check className={cn("text-background size-3")} />
                        </div>
                        <span>{column.columnDef.meta?.label || column.id}</span>
                        <span data-slot="command-shortcut" className="hidden" />
                        {enableColumnOrdering && !search ? (
                          <SortableDragHandle
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground focus:bg-muted focus:text-foreground ml-auto size-5"
                          >
                            <GripVertical
                              className="size-4"
                              aria-hidden="true"
                            />
                          </SortableDragHandle>
                        ) : null}
                      </CommandItem>
                    </SortableItem>
                  ))}
              </Sortable>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
