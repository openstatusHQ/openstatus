import { Badge } from "@openstatus/ui/src/components/badge";
import { Separator } from "@openstatus/ui/src/components/separator";
import { format } from "date-fns";

export function DayHeader({ date }: { date: Date }) {
  const isInFuture = date.getTime() > new Date().getTime();
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-muted-foreground text-sm">
          {format(date, "LLL dd, y")}
        </p>
        {isInFuture ? <Badge>Coming up</Badge> : null}
      </div>
      <Separator />
    </div>
  );
}
