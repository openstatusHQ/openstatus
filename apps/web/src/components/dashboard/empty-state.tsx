import * as React from "react";

import type { ValidIcon } from "@/components/icons";
import { Icons } from "@/components/icons";

interface Props extends React.ComponentProps<"div"> {
  icon: ValidIcon;
  title: string;
  description: string;
  action: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  const Icon = Icons[icon];
  return (
    <div className="border-border bg-background col-span-full w-full rounded-lg border border-dashed p-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center justify-center gap-1">
          <Icon className="h-6 w-6" />
          <p className="text-foreground text-base">{title}</p>
          <p className="text-muted-foreground text-center">{description}</p>
        </div>
        <div>{action}</div>
      </div>
    </div>
  );
}
