import * as React from "react";
import { format } from "date-fns";

import type { ValidIcon } from "@/components/icons";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

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
  const Icon = Icons[icon.name];
  return (
    <div className="group relative -m-2 flex gap-4 border border-transparent p-2">
      <div className="relative">
        <div
          className={cn(
            "bg-background rounded-full border p-2",
            icon.borderColor,
          )}
        >
          <Icon className={cn("h-4 w-4", icon.textColor)} />
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
  icon: {
    name: ValidIcon;
    textColor: string;
    borderColor: string;
  };
};

const timeline = [
  {
    label: "Monitor down",
    date: new Date("03.12.2023, 19:14:45"),
    message: "We couldn't reach your endpoint in Amsterdam.",
    icon: {
      name: "alert-triangle",
      textColor: "text-orange-500",
      borderColor: "border-orange-500/40",
    },
  },
  {
    label: "Grafana alert",
    date: new Date("03.12.2023, 19:14:55"),
    message: "3 incoming notifications from Grafana.",
    icon: {
      name: "webhook",
      textColor: "text-yellow-500",
      borderColor: "border-yellow-500/40",
    },
  },
  {
    label: "Notification sent",
    date: new Date("03.12.2023, 19:15:01"),
    message: "Smart notification with summary sent to your Slack channel.",
    icon: {
      name: "sparkles",
      textColor: "text-blue-500",
      borderColor: "border-blue-500/40",
    },
  },
  {
    label: "Monitor recovered",
    date: new Date("03.12.2023, 19:21:30"),
    message: "The enpoint response is back.",
    icon: {
      name: "check",
      textColor: "text-green-500",
      borderColor: "border-green-500/40",
    },
  },
] satisfies Event[];
