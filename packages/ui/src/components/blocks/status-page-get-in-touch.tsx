"use client";

import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";

/**
 * StatusPageGetInTouchIcon — ghost icon button with tooltip chrome.
 *
 * Pass the link element (with href + target + icon + sr-only label) as
 * children; the block layers Button styling, asChild Slot, and the tooltip.
 * Wraps in its own TooltipProvider so it's safe to mount anywhere.
 */
export function StatusPageGetInTouchIcon({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const labels = useStatusBlocksLabels();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-slot="status-page-get-in-touch-icon"
            variant="ghost"
            size="icon"
            type="button"
            className={cn("size-8", className)}
            asChild
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{labels.getInTouch}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * StatusPageGetInTouchButton — outlined text-label button.
 *
 * Pass the link element (with href + target) as children; the block layers
 * Button styling and asChild Slot. Default label is `labels.getInTouch` —
 * the caller's link content overrides it if they pass children with text.
 */
export function StatusPageGetInTouchButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="status-page-get-in-touch-button"
      variant="outline"
      size="sm"
      type="button"
      className={className}
      asChild
      {...props}
    />
  );
}
