"use client";

import { useEmbed } from "@/hooks/use-embed";
import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import NextLink from "next/link";

export const linkVariants = cva(
  "outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-sm",
  {
    variants: {
      variant: {
        default: "text-foreground font-medium",
        container: "focus-visible:border-ring",
        unstyled: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Link({
  children,
  className,
  variant,
  target,
  rel,
  ...props
}: React.ComponentProps<typeof NextLink> & VariantProps<typeof linkVariants>) {
  const { mode } = useEmbed();
  // NOTE: treat any non-internal href as external so we don't hijack protocol
  // links (mailto/tel/sms), absolute URLs, or protocol-relative URLs with
  // embed-mode target="_blank" overrides.
  const href = typeof props.href === "string" ? props.href : null;
  const isExternal =
    href !== null &&
    (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//"));
  const isAnchor = href?.startsWith("#");
  const shouldOpenNewTab = mode && !isExternal && !isAnchor;
  const embedTarget = shouldOpenNewTab ? "_blank" : target;
  const embedRel = shouldOpenNewTab ? rel ?? "noopener noreferrer" : rel;

  return (
    <NextLink
      className={cn(linkVariants({ variant, className }))}
      target={embedTarget}
      rel={embedRel}
      {...props}
    >
      {children}
    </NextLink>
  );
}
