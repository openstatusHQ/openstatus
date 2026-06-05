import { cn } from "@/lib/utils";
import type React from "react";

export function Subtle({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-muted-foreground", className)} {...props} />;
}
