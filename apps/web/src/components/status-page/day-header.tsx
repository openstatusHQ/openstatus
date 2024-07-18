import { Separator } from "@openstatus/ui";
import { format } from "date-fns";

export function DayHeader({ date }: { date: Date }) {
  return (
    <div className="grid gap-2">
      <p className="font-mono text-muted-foreground text-sm">
        {format(date, "LLL dd, y")}
      </p>
      <Separator />
    </div>
  );
}
