"use client";

import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import { RefreshCcw } from "lucide-react";

export function DataTableRefreshButton() {
  const { refresh, isLoading } = useDataTable();
  if (!refresh) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shadow-none"
            disabled={isLoading}
            onClick={() => refresh()}
          >
            <RefreshCcw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            <span className="sr-only">Refresh</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-nowrap">Refresh data</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
