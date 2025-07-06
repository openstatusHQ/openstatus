"use client";

import * as Portal from "@radix-ui/react-portal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function DevelopmentIndicator() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Portal.Root>
      <div className="pointer-events-none fixed inset-0 z-[9999] border-2 border-destructive" />
      <div className="fixed inset-x-0 bottom-0 z-[9999] select-none">
        <div className="flex items-center justify-center">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger>
                <div className="bg-destructive text-background w-fit font-mono text-xs rounded-t px-2 py-1">
                  In Development
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Be careful with your actions.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Portal.Root>
  );
}
