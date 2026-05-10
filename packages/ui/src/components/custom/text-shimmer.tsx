"use client";

import type { ComponentProps, ElementType, ReactNode } from "react";

import { cn } from "@openstatus/ui/lib/utils";

/**
 * CSS-only animated text shimmer — a gradient slides under a `bg-clip:text`
 * mask. Pure CSS keeps the runtime cost trivial (no motion / framer-motion
 * payload) and avoids hydration of a client-only animation library.
 *
 * Ported from openstatusHQ/data-table-filters. `spread` controls the width
 * of the highlight band (clamped to 5–45%); `duration` controls how long
 * one sweep takes. The keyframe `shimmer` is defined in `globals.css`.
 */
export type TextShimmerProps<E extends ElementType = "span"> = {
  as?: E;
  duration?: number;
  spread?: number;
  children: ReactNode;
} & Omit<ComponentProps<E>, "as" | "children">;

export function TextShimmer<E extends ElementType = "span">({
  as,
  className,
  duration = 3,
  spread = 20,
  children,
  ...props
}: TextShimmerProps<E>) {
  const Component = (as ?? "span") as ElementType;
  const dynamicSpread = Math.min(Math.max(spread, 5), 45);

  return (
    <Component
      className={cn(
        "bg-size-[200%_auto] bg-clip-text font-medium text-transparent",
        "animate-[shimmer_4s_infinite_linear]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(to right, var(--muted-foreground) ${50 - dynamicSpread}%, var(--foreground) 50%, var(--muted-foreground) ${50 + dynamicSpread}%)`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
