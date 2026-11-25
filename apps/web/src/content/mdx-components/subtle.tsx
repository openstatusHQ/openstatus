import type React from "react";

import { cn } from "@/lib/utils";

export function Subtle({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-muted-foreground", className)} {...props} />;
}
