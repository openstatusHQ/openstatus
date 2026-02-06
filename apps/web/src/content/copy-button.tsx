"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/components/ui/button";

export function CopyButton({
  className,
  copyText,
  buttonText = "copy",
  copiedText = "copied",
  ...props
}: React.ComponentProps<typeof Button> & {
  copyText: string;
  buttonText?: string;
  copiedText?: string;
}) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Button
      variant="ghost"
      size="lg"
      className={cn("rounded-none p-4", className)}
      onClick={() => copy(copyText, { withToast: true })}
      {...props}
    >
      {isCopied ? `[${copiedText}]` : `[${buttonText}]`}
    </Button>
  );
}
