"use client";

import { Check, Copy } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { useExtracted } from "next-intl";

export function ButtonCopyMarkdown({
  markdown,
  className,
  ...props
}: { markdown?: string } & React.ComponentProps<typeof Button>) {
  const t = useExtracted();
  const { copy, isCopied } = useCopyToClipboard();

  const handleCopy = () => {
    const textToCopy = markdown || (typeof window !== "undefined" ? window.location.href : "");
    copy(textToCopy, {
      successMessage: t("Markdown copied to clipboard"),
      withToast: true,
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("gap-1.5 text-xs", className)}
      type="button"
      {...props}
    >
      {isCopied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Copy className="size-4" />
      )}
      <span>{isCopied ? t("Copied") : t("Copy markdown")}</span>
      <span className="sr-only">{t("Copy markdown")}</span>
    </Button>
  );
}
