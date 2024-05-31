"use client";

import * as React from "react";

import { Icons } from "@/components/icons";
import { cn, copyToClipboard } from "@/lib/utils";

// TODO: make a generic copy to clipboard button

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  copyValue: string;
}

export function CopyToClipboardButton({ copyValue, className }: Props) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);
  return (
    <button
      type="button"
      onClick={() => {
        copyToClipboard(copyValue);
        setHasCopied(true);
      }}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      {!hasCopied ? (
        <Icons.copy className="h-3 w-3" />
      ) : (
        <Icons.check className="h-3 w-3" />
      )}
    </button>
  );
}
