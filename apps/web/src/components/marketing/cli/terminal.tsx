"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui";
import { CheckIcon, CopyIcon } from "lucide-react";
import type React from "react";

const command = "openstatus monitors trigger 420";

export function Terminal({ className, ...props }: React.ComponentProps<"pre">) {
  const { copy, isCopied } = useCopyToClipboard();

  function handleCopy() {
    copy(command, { withToast: true });
  }

  return (
    <div className="flex w-full items-center">
      <pre
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2",
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
          className="-mr-2 ml-auto hover:bg-transparent"
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
