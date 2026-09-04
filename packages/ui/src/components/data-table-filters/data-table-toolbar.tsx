"use client";

import { useControls } from "@openstatus/ui/components/data-table-filters/controls";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { Button } from "@openstatus/ui/components/ui/button";
import { Kbd } from "@openstatus/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useHotKey } from "@openstatus/ui/hooks/use-hot-key";
import { formatCompactNumber } from "@openstatus/ui/lib/format";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { DataTableFilterControlsDrawer } from "./data-table-filter-controls-drawer";
import { DataTableRefreshButton } from "./data-table-refresh-button";
import { DataTableResetButton } from "./data-table-reset-button";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps {
  renderActions?: () => React.ReactNode;
}

export function DataTableToolbar({ renderActions }: DataTableToolbarProps) {
  const { table, isLoading, columnFilters, totalRows, filterRows } =
    useDataTable();
  const { open, setOpen } = useControls();
  useHotKey(() => setOpen((prev) => !prev), "b");
  const rows = {
    total: totalRows ?? table.getCoreRowModel().rows.length,
    filtered: filterRows ?? table.getFilteredRowModel().rows.length,
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => setOpen((prev) => !prev)}
                className="hidden gap-2 sm:flex"
              >
                {open ? (
                  <>
                    <PanelLeftClose className="h-4 w-4" />
                    <span className="hidden md:block">Hide Controls</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="h-4 w-4" />
                    <span className="hidden md:block">Show Controls</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-nowrap">
                Toggle controls with{" "}
                <Kbd className="text-muted-foreground group-hover:text-accent-foreground ml-1">
                  <span className="mr-1">⌘</span>
                  <span>B</span>
                </Kbd>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="block sm:hidden">
          <DataTableFilterControlsDrawer />
        </div>
        <div>
          <p className="text-muted-foreground hidden text-sm sm:block">
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            of{" "}
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.total)}
            </span>{" "}
            row(s) <span className="sr-only sm:not-sr-only">filtered</span>
          </p>
          <p className="text-muted-foreground block text-sm sm:hidden">
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            row(s)
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {columnFilters.length ? <DataTableResetButton /> : null}
        {renderActions?.()}
        <DataTableRefreshButton />
        <DataTableViewOptions />
      </div>
    </div>
  );
}
