"use client";

import { Button } from "@/components/ui/button";
import { parseAsNumberLiteral, useQueryState } from "nuqs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";
import { Check } from "lucide-react";
import { INTERVALS } from "@/data/metrics.client";

const MAPPING = {
  5: "5 minutes",
  15: "15 minutes",
  30: "30 minutes",
  60: "1 hour",
  120: "2 hours",
  240: "4 hours",
  480: "8 hours",
  1440: "1 day",
} as const;

const parseInterval = parseAsNumberLiteral(INTERVALS).withDefault(30);

export function DropdownInterval() {
  const [interval, setInterval] = useQueryState("interval", parseInterval);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {MAPPING[interval]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
            Resolution
          </DropdownMenuLabel>
          {INTERVALS.map((item) => (
            <DropdownMenuItem key={item} onSelect={() => setInterval(item)}>
              {MAPPING[item]}
              {interval === item ? (
                <Check className="ml-auto shrink-0" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
