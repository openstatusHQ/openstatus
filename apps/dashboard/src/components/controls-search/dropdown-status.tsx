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
import { STATUS } from "@/data/metrics.client";

const parseStatus = parseAsStringLiteral(STATUS);

export function DropdownStatus() {
  const [status, setStatus] = useQueryState("status", parseStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="capitalize">
          {status ?? "All Status"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
            Status
          </DropdownMenuLabel>
          {STATUS.map((item) => (
            <DropdownMenuItem
              key={item}
              onSelect={() => setStatus(item)}
              className={cn("capitalize")}
            >
              {item}
              {status === item ? <Check className="ml-auto shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
