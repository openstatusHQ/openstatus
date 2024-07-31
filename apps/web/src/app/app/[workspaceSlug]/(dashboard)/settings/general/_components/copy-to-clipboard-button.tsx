"use client";

import * as React from "react";

import type { ButtonProps } from "@openstatus/ui";
import { Button } from "@openstatus/ui/src/components/button";

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
        <Icons.copy className="ml-2 hidden h-4 w-4 group-hover:block" />
      ) : (
        <Icons.check className={cn("ml-2 h-4 w-4")} />
      )}
    </Button>
  );
}
