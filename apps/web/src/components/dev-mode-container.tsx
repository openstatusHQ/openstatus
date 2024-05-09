import * as React from "react";

import { cn } from "@/lib/utils";

export default function DevModeContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-destructive/80 relative -m-2 rounded-lg border-2 p-2",
        className,
      )}
    >
      <p className="text-destructive bg-background absolute -top-2 left-3 px-1 text-xs font-medium uppercase">
        dev mode
      </p>
      {children}
    </div>
  );
}
