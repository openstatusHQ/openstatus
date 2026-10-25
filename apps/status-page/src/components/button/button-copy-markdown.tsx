"use client";

import { Check, Copy } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";

export function ButtonCopyMarkdown({
  markdown,
  className,
  ...props
}: { markdown?: string } & React.ComponentProps<typeof Button>) {
  const t = useExtracted();
  const { copy, isCopied } = useCopyToClipboard();
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (isLoading) return;
    try {
      let content = markdown;
      if (!content && typeof window !== "undefined") {
        setIsLoading(true);
        const mdUrl = window.location.pathname.replace(/\/$/, "") + ".md";
        const res = await fetch(mdUrl);
        if (res.ok) {
          content = await res.text();
        }
      }
      if (content) {
        copy(content, {
          successMessage: t("Markdown copied to clipboard"),
          withToast: true,
        });
      }
    } catch (err) {
      console.error("Failed to fetch or copy markdown:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={isLoading}
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
    </Button>
  );
}
