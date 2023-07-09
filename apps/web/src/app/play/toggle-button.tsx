"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

import type { GroupByRange } from "@openstatus/tinybird";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useUpdateSearchParams from "@/hooks/use-update-search-params";

export function ToggleButton({ groupBy }: { groupBy?: GroupByRange }) {
  const router = useRouter();
  const updateSearchParams = useUpdateSearchParams();
  const pathname = usePathname();

  const isDay = groupBy === "day";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isDay ? "default" : "outline"}
            size="icon"
            onClick={() => {
              router.replace(
                `${pathname}?${updateSearchParams({
                  groupBy: isDay ? null : "day",
                })}`,
              );
            }}
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isDay ? "by ping" : "by day"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
