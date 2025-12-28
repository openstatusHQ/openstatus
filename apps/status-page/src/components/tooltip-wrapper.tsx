"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function TooltipWrapper({
  label,
  command,
  className,
  children,
  ...props
}: ComponentProps<typeof TooltipTrigger> & {
  label: string;
  command?: React.ReactNode;
}) {
  return (
    <Tooltip key={label}>
      <TooltipTrigger className={cn(className)} {...props}>
        {children}
      </TooltipTrigger>

      <TooltipContent>
        <span className="flex items-center gap-[1ch]">
          {label}
          {command && (
            <kbd className="flex items-center gap-[0.5ch] rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs [&>svg]:size-3">
              {command}
            </kbd>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
