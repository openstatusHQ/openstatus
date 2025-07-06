"use client";

import { Button } from "@/components/ui/button";
import { parseAsStringLiteral, useQueryState } from "nuqs";
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
import { cn } from "@/lib/utils";
import { TRIGGER } from "@/data/metrics.client";

const parseTrigger = parseAsStringLiteral(TRIGGER);

export function DropdownTrigger() {
  const [trigger, setTrigger] = useQueryState("trigger", parseTrigger);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="capitalize">
          {trigger ?? "All Trigger"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
            Trigger
          </DropdownMenuLabel>
          {TRIGGER.map((item) => (
            <DropdownMenuItem
              key={item}
              onSelect={() => setTrigger(item)}
              className={cn("capitalize")}
            >
              {item}
              {trigger === item ? <Check className="ml-auto shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
