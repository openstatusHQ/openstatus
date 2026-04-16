"use client";

import { ALL_EMBED_SECTIONS, useEmbed } from "@/hooks/use-embed";
import { cn } from "@openstatus/ui/lib/utils";

export function EmbedShell({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { mode, sections } = useEmbed();
  const hideAttrs = ALL_EMBED_SECTIONS.reduce<Record<string, "true">>(
    (acc, section) => {
      if (!sections.includes(section)) acc[`data-hide-${section}`] = "true";
      return acc;
    },
    {},
  );

  return (
    <div
      {...props}
      data-embed={mode ? "true" : undefined}
      className={cn("group/embed", className)}
      {...hideAttrs}
    >
      {children}
    </div>
  );
}
