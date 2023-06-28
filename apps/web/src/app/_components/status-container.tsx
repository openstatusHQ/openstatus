import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistance } from "date-fns";

// TODO: consistency in wording
export function StatusContainer({
  events,
}: {
  // FIXME: should be return type
  events: { id: string; timestamp: number; statusCode: number }[];
}) {
  return (
    // OVERFLOW-HIDDEN
    <div className="border-border relative mx-auto max-h-28 overflow-hidden rounded-lg border p-4 backdrop-blur-[2px]">
      <div className="from-background to-background absolute inset-0 bg-gradient-to-b from-0% via-transparent via-50% to-100%" />
      <ul className="text-muted-foreground grid gap-2 text-xs">
        {events.map(({ timestamp, statusCode }) => {
          return (
            <li key={timestamp} className="flex items-center justify-between">
              <p className="font-light">
                {formatDistance(new Date(timestamp), new Date(), {
                  addSuffix: true,
                  includeSeconds: true,
                })}
              </p>
              <Badge variant="outline" className="ml-1 px-2 py-0.5 text-xs">
                {statusCode}
                <div
                  className={cn(
                    "bg-foreground ml-1 h-1.5 w-1.5 rounded-full",
                    statusCode === 200 ? "bg-green-500" : "bg-red-500",
                  )}
                />
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
