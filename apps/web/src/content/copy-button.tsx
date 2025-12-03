"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui";

export function CopyButton({
  className,
  copyText,
  ...props
}: React.ComponentProps<typeof Button> & { copyText: string }) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Button
      variant="ghost"
      size="lg"
      className={cn("rounded-none p-4", className)}
      onClick={() => copy(copyText, { withToast: true })}
      {...props}
    >
      {isCopied ? "[link copied]" : "[copy link]"}
    </Button>
  );
}
