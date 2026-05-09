import type { ComponentProps, ElementType } from "react";

import { cn } from "@openstatus/ui/lib/utils";

/**
 * CSS-only animated text shimmer — gradient slides under a `bg-clip:text`
 * mask. Used as a "Thinking…" indicator while awaiting model output.
 *
 * Pure CSS keeps the runtime cost trivial (no motion / framer-motion
 * payload) and avoids hydration of a client-only animation library.
 * Kept here so any app in the monorepo can use it.
 */
export type TextShimmerProps<E extends ElementType = "span"> = {
  as?: E;
} & Omit<ComponentProps<E>, "as">;

export function TextShimmer<E extends ElementType = "span">({
  as,
  className,
  ...props
}: TextShimmerProps<E>) {
  const Component = (as ?? "span") as ElementType;
  return (
    <Component
      className={cn(
        "inline-block bg-clip-text text-transparent",
        "bg-[linear-gradient(90deg,var(--color-muted-foreground)_0%,var(--color-muted-foreground)_40%,var(--color-foreground)_50%,var(--color-muted-foreground)_60%,var(--color-muted-foreground)_100%)]",
        "bg-[length:200%_100%] animate-text-shimmer",
        className,
      )}
      {...props}
    />
  );
}
