"use client";

import * as React from "react";

import { Icons, ValidIcon } from "@openstatus/ui";
import { cn, copyToClipboard } from "@/lib/utils";

// TODO: make a generic copy to clipboard button

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  copyValue: string | (() => string);
  copyIcon?: ValidIcon;
}

export function CopyToClipboardButton({
  copyValue,
  copyIcon,
  className,
}: Props) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      // TODO: add toast
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);

  const Icon = hasCopied
    ? Icons.check
    : copyIcon
      ? Icons[copyIcon]
      : Icons.copy;

  return (
    <button
      type="button"
      onClick={() => {
        copyToClipboard(
          typeof copyValue === "function" ? copyValue() : copyValue
        );
        setHasCopied(true);
      }}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      <Icon className="w-4 h-4" />
      <span className="sr-only">Copy</span>
    </button>
  );
}

export function getCurrentLink() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}
