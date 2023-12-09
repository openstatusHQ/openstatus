"use client";

import * as React from "react";

import { Button } from "@openstatus/ui";
import type { ButtonProps } from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { copyToClipboard } from "@/lib/utils";

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
        copyToClipboard(children?.toString() ?? "");
        setHasCopied(true);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
      {!hasCopied ? (
        <Icons.copy className="ml-2 h-4 w-4" />
      ) : (
        <Icons.check className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}
