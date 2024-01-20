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
import { copyToClipboard } from "@/lib/utils";

export function CopyLinkButton() {
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
            onClick={() => {
              if (typeof window === "undefined") return;
              copyToClipboard(window.location.href);
              setHasCopied(true);
            }}
            size="icon"
            variant="ghost"
          >
            {!hasCopied ? (
              <Icons.link className="h-4 w-4" />
            ) : (
              <Icons.check className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy link</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
