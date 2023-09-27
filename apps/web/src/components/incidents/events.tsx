"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, formatDistance } from "date-fns";
import type * as z from "zod";

import type { selectIncidentUpdateSchema } from "@openstatus/db/src/schema";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { statusDict } from "@/data/incidents-dictionary";
import { useProcessor } from "@/hooks/use-preprocessor";
import { cn } from "@/lib/utils";
import { DeleteIncidentUpdateButtonIcon } from "../../app/app/(dashboard)/[workspaceSlug]/incidents/_components/delete-incident-update";

type IncidentUpdateProps = z.infer<typeof selectIncidentUpdateSchema>;

export function Events({
  incidentUpdates,
  editable = false,
}: {
  incidentUpdates: IncidentUpdateProps[];
  editable?: boolean;
}) {
  const [open, toggle] = React.useReducer((open) => !open, false);
  const router = useRouter();

  // TODO: make it simpler..
  const sortedArray = incidentUpdates.sort((a, b) => {
    const orderA = statusDict[a.status].order;
    const orderB = statusDict[b.status].order;
    return orderB - orderA;
  });
  const slicedArray = open
    ? sortedArray
    : sortedArray.length > 0
    ? [sortedArray[0]]
    : [];
  //

  return (
    <div className="grid gap-3">
      {slicedArray?.map((update, i) => {
        const { icon, label } = statusDict[update.status];
        const StatusIcon = Icons[icon];
        return (
          <div
            key={update.id}
            className={cn(
              "group relative -m-2 flex gap-4 border border-transparent p-2",
              editable && "hover:bg-accent/40 hover:rounded-lg",
            )}
          >
            <div className="relative">
              <div className="bg-background border-border rounded-full border p-2">
                <StatusIcon className="h-4 w-4" />
              </div>
              {i !== sortedArray.length - 1 ? (
                <div className="bg-muted absolute inset-x-0 mx-auto h-full w-[2px]" />
              ) : null}
            </div>
            <div className="mt-1 grid flex-1 gap-3">
              {editable ? (
                <div className="absolute bottom-2 right-2 hidden gap-2 group-hover:flex group-active:flex">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      router.push(
                        `./incidents/update/edit?incidentId=${update.incidentId}&id=${update.id}`,
                      );
                    }}
                  >
                    <Icons.pencil className="h-4 w-4" />
                  </Button>
                  <DeleteIncidentUpdateButtonIcon id={update.id} />
                </div>
              ) : undefined}
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold">{label}</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-muted-foreground text-xs font-light">
                      {formatDistance(new Date(update.date), new Date(), {
                        addSuffix: true,
                      })}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(update.date), "LLL dd, y HH:mm")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {/* <p className="max-w-3xl text-sm">{update.message}</p> */}
              <EventMessage message={update.message} />
            </div>
          </div>
        );
      })}

      {incidentUpdates.length > 1 ? (
        <div className="text-center">
          <Button variant="ghost" onClick={toggle}>
            {open ? "Close" : "More"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EventMessage({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  const Component = useProcessor(message);
  return (
    <div
      className={cn(
        "prose dark:prose-invert prose-sm prose-headings:font-cal overflow-hidden text-ellipsis", // fixes very long words
        className,
      )}
    >
      {Component}
    </div>
  );
}
