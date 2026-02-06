"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";

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
