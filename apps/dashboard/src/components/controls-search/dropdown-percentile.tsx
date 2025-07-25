"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERCENTILES } from "@/data/metrics.client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

const parsePercentile = parseAsStringLiteral(PERCENTILES).withDefault("p50");

export function DropdownPercentile() {
  const [percentile, setPercentile] = useQueryState(
    "percentile",
    parsePercentile,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="capitalize">
          {percentile}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
            Percentile
          </DropdownMenuLabel>
          {PERCENTILES.map((item) => (
            <DropdownMenuItem
              key={item}
              onSelect={() => setPercentile(item)}
              className={cn("capitalize")}
            >
              {item}
              {percentile === item ? (
                <Check className="ml-auto shrink-0" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
