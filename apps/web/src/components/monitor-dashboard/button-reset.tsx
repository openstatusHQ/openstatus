"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@openstatus/ui/src/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

export function ButtonReset() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => {
              router.push(pathname);
              router.refresh();
            }}
            variant="ghost"
            size="lg"
            className="px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Reset your filters</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
