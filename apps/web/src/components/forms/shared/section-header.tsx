import * as React from "react";

import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  className,
}: {
  title: string;
  description: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-1", className)}>
      <h4 className="text-foreground font-medium">{title}</h4>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
