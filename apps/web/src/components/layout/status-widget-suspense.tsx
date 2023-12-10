import { Suspense } from "react";
import { ExternalLink } from "lucide-react";

import type { StatusWidgetProps } from "@openstatus/react";
import { StatusWidget } from "@openstatus/react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

export function StatusWidgetFallback() {
  return (
    <div className="border-border flex max-w-fit items-center gap-2 rounded-md border px-3 py-1 text-sm">
      <span className="bg-muted h-5 w-20 animate-pulse rounded-md" />
      <span className="bg-muted relative inline-flex h-2 w-2 rounded-full" />
    </div>
  );
}

export function StatusWidgetContainer(props: StatusWidgetProps) {
  return (
    <Suspense fallback={<StatusWidgetFallback />}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="max-w-min">
              <StatusWidget {...props} />
            </div>
          </TooltipTrigger>
          <TooltipContent asChild>
            <Button variant="link" size="sm" asChild>
              <a
                target="_blank"
                href="https://docs.openstatus.dev/packages/react"
              >
                Install your own <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Suspense>
  );
}
