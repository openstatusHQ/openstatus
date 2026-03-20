"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import { useExtracted } from "next-intl";

export function ButtonCopyLink({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const t = useExtracted();
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() =>
        copy(window.location.href, {
          successMessage: t("Link copied to clipboard"),
          withToast: true,
        })
      }
      className={cn("size-8", className)}
      {...props}
    >
      {isCopied ? <Check /> : <Copy />}
      <span className="sr-only">{t("Copy Link")}</span>
    </Button>
  );
}
