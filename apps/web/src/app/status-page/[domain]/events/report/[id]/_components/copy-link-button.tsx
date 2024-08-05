"use client";

import * as React from "react";

import { Button } from "@openstatus/ui/src/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

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
            variant="ghost"
            size="icon"
            onClick={() => {
              const text =
                typeof window !== "undefined" ? window.location.href : "";
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
          <p>Copy link</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
