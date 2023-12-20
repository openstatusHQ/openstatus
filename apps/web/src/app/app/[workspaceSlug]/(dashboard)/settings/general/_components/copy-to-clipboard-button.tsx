"use client";

import * as React from "react";

import { Button } from "@openstatus/ui";
import type { ButtonProps } from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { cn, copyToClipboard } from "@/lib/utils";

export function CopyToClipboardButton({
  children,
  onClick,
  ...props
}: ButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);

  return (
    <Button
      onClick={(e) => {
        copyToClipboard(children?.toString() || "");
        setHasCopied(true);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
      {!hasCopied ? (
        <Icons.copy className={cn("h-4 w-4", children && "ml-2")} />
      ) : (
        <Icons.check className={cn("h-4 w-4", children && "ml-2")} />
      )}
    </Button>
  );
}
