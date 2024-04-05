import * as React from "react";
import { format } from "date-fns";

import type { ValidIcon } from "@/components/icons";
import { Icons } from "@/components/icons";

export function Event({
  label,
  date,
  icon,
  children,
}: {
  label: string;
  date: Date;
  icon: ValidIcon;
  children?: React.ReactNode;
}) {
  const Icon = Icons[icon];
  return (
    <div className="group relative -m-2 flex gap-4 border border-transparent p-2">
      <div className="relative">
        <div className="bg-background rounded-full border p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div className="bg-muted absolute inset-x-0 mx-auto h-full w-[2px]" />
      </div>
      <div className="mt-1 flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-muted-foreground mt-px text-right text-[10px]">
            <code>{format(new Date(date), "LLL dd, y HH:mm:ss")}</code>
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
