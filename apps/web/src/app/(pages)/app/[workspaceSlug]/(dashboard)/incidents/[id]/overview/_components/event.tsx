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
    <div className="group -m-2 relative flex gap-4 border border-transparent p-2">
      <div className="relative">
        <div className="rounded-full border bg-background p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div className="absolute inset-x-0 mx-auto h-full w-[2px] bg-muted" />
      </div>
      <div className="mt-1 flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold text-sm">{label}</p>
          <p className="mt-px text-right text-[10px] text-muted-foreground">
            <code>{format(new Date(date), "LLL dd, y HH:mm:ss")}</code>
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
