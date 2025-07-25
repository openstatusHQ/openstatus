import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

const kbdVariants = cva(
  "-me-1 ms-2 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] font-medium text-[0.625rem]",
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
