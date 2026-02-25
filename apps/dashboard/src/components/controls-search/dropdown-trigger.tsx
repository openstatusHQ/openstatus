"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { cn } from "@openstatus/ui/lib/utils";
import { Check } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

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
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            Trigger
          </DropdownMenuLabel>
          {TRIGGER.map((item) => (
            <DropdownMenuItem
              key={item}
              onSelect={() => setTrigger(item)}
              className={cn("capitalize")}
            >
              {item === "cron" ? "Scheduled" : "API"}
              {trigger === item ? <Check className="ml-auto shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
