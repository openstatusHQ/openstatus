"use client";

import * as React from "react";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { cn, copyToClipboard } from "@/lib/utils";

export function CopyToClipboardButton({
  text,
  tooltipText,
  className,
}: {
  text: string;
  tooltipText: string;
  className?: string;
}) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", className)}
            onClick={() => {
              copyToClipboard(text);
              setHasCopied(true);
            }}
          >
            {!hasCopied ? (
              <Icons.link className="h-4 w-4" />
            ) : (
              <Icons.check className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
