"use client";

import { ALL_IFRAME_SECTIONS, useIframe } from "@/hooks/use-iframe";
import { cn } from "@openstatus/ui/lib/utils";

export function IframeShell({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { mode, sections } = useIframe();
  const hideAttrs = ALL_IFRAME_SECTIONS.reduce<Record<string, "true">>(
    (acc, section) => {
      if (!sections.includes(section)) acc[`data-hide-${section}`] = "true";
      return acc;
    },
    {},
  );

  return (
    <div
      {...props}
      data-iframe={mode ? "true" : undefined}
      className={cn("group/iframe", className)}
      {...hideAttrs}
    >
      {children}
    </div>
  );
}
