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
    <pre
      className={cn(
        "relative rounded-md border bg-muted p-2 text-xs",
        className
      )}
      {...props}
    >
      {children}
      <Button
        variant="outline"
        size="icon"
        className="absolute top-0.5 right-1 size-6 p-1"
        onClick={() =>
          copy(children?.toString() ?? "", {
            withToast: false,
            timeout: 1000,
          })
        }
      >
        {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </Button>
    </pre>
  );
}
