import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const kbdVariants = cva(
  "ms-2 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium",
  {
    variants: {
      variant: {
        default: "border-input bg-background text-muted-foreground/70",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Kbd({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return (
    <kbd className={cn(kbdVariants({ variant, className }))} {...props}>
      {children}
    </kbd>
  );
}
