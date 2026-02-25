"use client";

import { Kbd } from "@openstatus/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
import * as Portal from "@radix-ui/react-portal";

export function DevelopmentIndicator() {
  const isMobile = useIsMobile();

  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Portal.Root>
      <div className="border-destructive pointer-events-none fixed inset-0 z-[9999] border-2" />
      <div className="fixed inset-x-0 bottom-0 z-[9999] select-none">
        <div className="flex items-center justify-center">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger>
                <div className="bg-destructive text-background w-fit rounded-t px-2 py-1 font-mono text-xs">
                  In Beta
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {!isMobile ? (
                  <p>
                    Press <Kbd className="ms-0 -me-0">F</Kbd> key to provide
                    feedback.
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
