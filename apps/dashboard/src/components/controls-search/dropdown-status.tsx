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
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            Request Status
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
