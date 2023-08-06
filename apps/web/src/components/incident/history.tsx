import { formatDistance } from "date-fns";

import { IncidentEvent } from "./event";

const array = new Array(2).fill(1691268078000);

export function IncidentHistory() {
  return (
    <ul role="list" className="grid gap-4 sm:col-span-5">
      {array.map((timestamp, i) => {
        return (
          <li key={i} className="grid gap-2">
            <time className="text-muted-foreground pl-3 text-xs">
              {formatDistance(new Date(timestamp), new Date(), {
                addSuffix: true,
              })}
            </time>
            <IncidentEvent />
          </li>
        );
      })}
    </ul>
  );
}
