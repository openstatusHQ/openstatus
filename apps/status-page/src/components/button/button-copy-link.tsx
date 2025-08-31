"use client";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

export function ButtonCopyLink({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() =>
        copy(window.location.href, {
          successMessage: "Link copied to clipboard",
        })
      }
      className={cn("size-8", className)}
      {...props}
    >
      {isCopied ? <Check /> : <Copy />}
      <span className="sr-only">Copy Link</span>
    </Button>
  );
}
