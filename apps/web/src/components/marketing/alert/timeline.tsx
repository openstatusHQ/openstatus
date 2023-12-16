import * as React from "react";
import { format } from "date-fns";

import type { ValidIcon } from "@/components/icons";
import { Icons } from "@/components/icons";

export function TimelineContainer({ children }: { children: React.ReactNode }) {
  return (
    // first:md:order-2 does not work
    <div className="mx-auto flex max-w-md flex-col justify-center gap-3 md:order-2">
      {children}
    </div>
  );
}

export function TimelineEvent({
  label,
  date,
  message,
  icon,
  isLast = false,
}: Event & {
  isLast?: boolean;
}) {
  const Icon = Icons[icon];
  return (
    <div className="group relative -m-2 flex gap-4 border border-transparent p-2">
      <div className="relative">
        <div className="bg-background border-border rounded-full border p-2">
          <Icon className="h-4 w-4" />
        </div>
        {!isLast ? (
          <div className="bg-muted absolute inset-x-0 mx-auto h-full w-[2px]" />
        ) : null}
      </div>
      <div className="mt-1 flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-muted-foreground mt-px text-right text-[10px]">
            <code>{format(new Date(date), "LLL dd, y HH:mm:ss")}</code>
          </p>
        </div>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}

export function Timeline() {
  return (
    <TimelineContainer>
      {timeline.map((event, i) => (
        <TimelineEvent key={i} isLast={i === timeline.length - 1} {...event} />
      ))}
    </TimelineContainer>
  );
}

type Event = {
  label: string;
  date: Date;
  message: string;
  icon: ValidIcon;
};

const timeline = [
  {
    label: "Monitor down",
    date: new Date("03.12.2023, 19:14:45"),
    message: "We couldn't reach your endpoint in Amsterdam.",
    icon: "alert-triangle",
  },
  {
    label: "Grafana alert",
    date: new Date("03.12.2023, 19:14:55"),
    message: "3 incoming notifications from Grafana.",
    icon: "webhook",
  },
  {
    label: "Notification sent",
    date: new Date("03.12.2023, 19:15:01"),
    message: "Smart notification with summary sent to your Slack channel.",
    icon: "sparkles",
  },
  {
    label: "Monitor recovered",
    date: new Date("03.12.2023, 19:21:30"),
    message: "The enpoint response is back.",
    icon: "check",
  },
] satisfies Event[];
