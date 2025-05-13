"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { Copy } from "lucide-react";

export function CopyButton({ id }: { id: string | number }) {
  const { copy } = useCopyToClipboard();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="font-mono"
            onClick={() => {
              copy(`${id}`, {
                withToast: `Copied ID '${id}'`,
              });
            }}
          >
            <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
            {id}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy ID for API usage</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
