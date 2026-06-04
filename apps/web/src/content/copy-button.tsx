"use client";

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
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeMiterlimit="10"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 15L3 15L3 3L17 3L17 9" />
      <path d="M7 9L7 21L21 21L21 9L7 9Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AnimatedCopyIcon({ isCopied }: { isCopied: boolean }) {
  return (
    <span className="relative inline-flex size-4">
      <CopyIcon
        className={cn(
          "absolute inset-0 transition-[opacity,transform,filter] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          isCopied
            ? "scale-[0.25] opacity-0 blur-[4px]"
            : "scale-100 opacity-100 blur-0",
        )}
      />
      <CheckIcon
        className={cn(
          "absolute inset-0 transition-[opacity,transform,filter] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          isCopied
            ? "scale-100 opacity-100 blur-0"
            : "scale-[0.25] opacity-0 blur-[4px]",
        )}
      />
    </span>
  );
}

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
  const { copy, isCopied } = useCopyToClipboard();

  const handleCopyLink = () => {
    copy(window.location.href, {
      successMessage: "Link copied to clipboard",
      withToast: true,
    });
  };

  const handleCopyMarkdown = async () => {
    try {
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
      toast.success("Markdown copied to clipboard");
    } catch (_error) {
      toast.error("Failed to copy markdown");
    }
  };

  return (
    <ButtonGroup
      className={cn("rounded-none border-none", className)}
      {...props}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 rounded-none px-2 text-muted-foreground transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
        onClick={handleCopyLink}
        aria-label={isCopied ? "Link copied" : "Copy link"}
      >
        <span className="relative top-px">
          <AnimatedCopyIcon isCopied={isCopied} />
        </span>
        <span className="text-sm">{isCopied ? "Copied" : "Copy link"}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="group h-8 w-6 rounded-none text-muted-foreground transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
            aria-label="More copy options"
          >
            <ChevronDown className="size-3 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
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
              onClick={handleCopyMarkdown}
            >
              Copy as Markdown
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
