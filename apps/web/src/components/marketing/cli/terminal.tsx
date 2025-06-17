"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui";
import { CheckIcon, CopyIcon } from "lucide-react";
import type React from "react";

const command = "brew tap openstatusHQ/cli";

export function Terminal({ className, ...props }: React.ComponentProps<"pre">) {
  const { copy, isCopied } = useCopyToClipboard();

  function handleCopy() {
    copy(command, { withToast: true });
  }

  return (
    <div className="flex items-center w-full">
      <pre
        className={cn(
          "bg-muted/50 w-full rounded-lg px-4 py-2 flex items-center gap-2 border",
          className,
        )}
        {...props}
      >
        <code className="text-sm">
          <span className="text-muted-foreground">$</span> {command}
        </code>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="ml-auto -mr-2 hover:bg-transparent"
        >
          {isCopied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </Button>
      </pre>
    </div>
  );
}
