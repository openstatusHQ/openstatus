"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import * as Portal from "@radix-ui/react-portal";
import { Kbd } from "./common/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function DevelopmentIndicator() {
  const isMobile = useIsMobile();

  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Portal.Root>
      <div className="pointer-events-none fixed inset-0 z-[9999] border-2 border-destructive" />
      <div className="fixed inset-x-0 bottom-0 z-[9999] select-none">
        <div className="flex items-center justify-center">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger>
                <div className="w-fit rounded-t bg-destructive px-2 py-1 font-mono text-background text-xs">
                  In Beta
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {!isMobile ? (
                  <p>
                    Press{" "}
                    <Kbd variant="secondary" className="-me-0 ms-0">
                      F
                    </Kbd>{" "}
                    key to provide feedback.
                  </p>
                ) : (
                  <p>Use a larger screen to provide feedback.</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Portal.Root>
  );
}
