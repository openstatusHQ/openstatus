"use client";

import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

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
