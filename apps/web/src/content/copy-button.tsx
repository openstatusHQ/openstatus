"use client";

import { useOpenPanel } from "@openpanel/nextjs";
import { Button } from "@openstatus/ui/components/ui/button";
import { ButtonGroup } from "@openstatus/ui/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

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

export function CopyDropdownButton({
  className,
  ...props
}: React.ComponentProps<typeof ButtonGroup>) {
  const { track } = useOpenPanel();
  const { copy, isCopied } = useCopyToClipboard();
  const [isMarkdownCopied, setIsMarkdownCopied] = useState(false);

  const handleCopyLink = () => {
    track("content_copied", { kind: "link", path: window.location.pathname });
    copy(window.location.href, {
      successMessage: "Link copied to clipboard",
      withToast: true,
    });
  };

  const handleCopyMarkdown = async () => {
    track("content_copied", {
      kind: "markdown",
      path: window.location.pathname,
    });
    try {
      // Safari only honors clipboard writes inside the click, so the fetch
      // goes in as a promise instead of awaiting it first.
      const item = new ClipboardItem({
        "text/plain": fetch(window.location.pathname, {
          headers: { Accept: "text/markdown" },
        })
          .then((r) => {
            if (!r.ok) throw new Error("Failed to fetch markdown");
            return r.text();
          })
          .then((text) => new Blob([text], { type: "text/plain" })),
      });

      await navigator.clipboard.write([item]);
      setIsMarkdownCopied(true);
      setTimeout(() => setIsMarkdownCopied(false), 3000);
      toast.success("Markdown copied to clipboard");
    } catch (_error) {
      toast.error("Failed to copy markdown");
    }
  };

  return (
    <ButtonGroup
      className={cn("rounded-none border-none p-4", className)}
      {...props}
    >
      <Button
        variant="ghost"
        className="rounded-none p-4"
        onClick={handleCopyMarkdown}
      >
        {isMarkdownCopied ? "[markdown copied]" : "[copy markdown]"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="group rounded-none"
            aria-label="Copy dropdown"
          >
            <span
              className="text-muted-foreground group-hover:text-foreground group-data-[state=open]:text-foreground relative top-[1px] shrink-0 origin-center font-sans text-[10px] transition duration-300 group-data-[state=open]:rotate-180"
              aria-hidden="true"
            >
              ▲
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-none"
          alignOffset={0}
          sideOffset={0}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="rounded-none font-mono"
              onClick={handleCopyLink}
            >
              {isCopied ? "[link copied]" : "[copy link]"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
