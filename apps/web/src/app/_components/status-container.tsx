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
    <div className="relative border border-border rounded-lg backdrop-blur-[2px] p-4 mx-auto max-h-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background from-0% via-transparent via-50% to-background to-100%" />
      <ul className="grid gap-2 text-xs text-muted-foreground">
        {events.map(({ timestamp, statusCode }) => {
          return (
            <li key={timestamp} className="flex items-center justify-between">
              <p className="font-light">
                {formatDistance(new Date(timestamp), new Date(), {
                  addSuffix: true,
                  includeSeconds: true,
                })}
              </p>
              <Badge variant="outline" className="text-xs ml-1 py-0.5 px-2">
                {statusCode}
                <div
                  className={cn(
                    "rounded-full bg-foreground h-1.5 w-1.5 ml-1",
                    statusCode === 200 ? "bg-green-500" : "bg-red-500"
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
