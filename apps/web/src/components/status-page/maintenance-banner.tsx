import { isSameDay, format } from "date-fns";
import { Hammer } from "lucide-react";

import type { Maintenance } from "@openstatus/db/src/schema";
import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";

export function MaintenanceBanner(props: Maintenance) {
  return (
    <Alert className="border-blue-500/20 bg-blue-500/10">
      <Hammer className="h-4 w-4" />
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription>{props.message}</AlertDescription>
      <AlertDescription className="mt-2 font-mono">
        {format(props.from, "LLL dd, y HH:mm")} -{" "}
        {isSameDay(props.from, props.to)
          ? format(props.to, "HH:mm")
          : format(props.to, "LLL dd, y HH:mm")}
      </AlertDescription>
    </Alert>
  );
}
