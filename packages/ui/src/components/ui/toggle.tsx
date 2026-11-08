"use client";

import { cn } from "@openstatus/ui/lib/utils";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

const toggleVariants = cva(
  "hover:bg-muted hover:text-muted-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border-input hover:bg-accent hover:text-accent-foreground border bg-transparent shadow-xs",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Styled via aria-pressed rather than data-state: a Tooltip/Popover trigger
// with asChild overwrites data-state with its own open/closed value.
function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
