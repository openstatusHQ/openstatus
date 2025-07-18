"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Check, Copy } from "lucide-react";

export function Code({
  children,
  className,
  ...props
}: React.ComponentProps<"pre">) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <div className="relative">
      <pre
        className={cn(
          "rounded-md border bg-muted p-2 text-xs overflow-x-auto",
          className
        )}
        {...props}
      >
        {children}
      </pre>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-1 right-1 size-6 p-1 backdrop-blur-md"
        onClick={() =>
          copy(children?.toString() ?? "", {
            withToast: false,
            timeout: 1000,
          })
        }
      >
        {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </Button>
    </div>
  );
}
