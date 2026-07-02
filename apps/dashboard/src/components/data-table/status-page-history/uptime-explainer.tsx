"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

function Basis({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
      {children}
    </span>
  );
}

export function UptimeExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full cursor-pointer rounded-xl">
        <Card className="gap-0 border-dashed py-0 text-left shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 px-3 py-2 select-none">
            <div className="space-y-1">
              <CardTitle className="text-sm">
                How uptime is calculated
              </CardTitle>
              <CardDescription>
                Each percentage depends on the page's calculation mode and the
                component type.
              </CardDescription>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          </CardHeader>
          <CollapsibleContent
            onClick={(e) => e.stopPropagation()}
            className="cursor-auto"
          >
            <CardContent className="space-y-4 px-3 pb-2 text-sm">
              <p className="text-muted-foreground">
                The calculation mode is set page-wide in the status page
                settings. Changing it only affects future months — published
                history is never rewritten.
              </p>
              <ul className="space-y-2.5">
                <li>
                  <Basis>requests</Basis>{" "}
                  <span className="text-muted-foreground">
                    — Monitor components. Uptime is{" "}
                    <span className="text-foreground font-medium">
                      (ok + degraded) / total checks
                    </span>
                    . Degraded responses still count as up.
                  </span>
                </li>
                <li>
                  <Basis>duration</Basis>{" "}
                  <span className="text-muted-foreground">
                    — Monitor components. Downtime is measured from incident and
                    status-report intervals, weighted by impact (major outage
                    counts fully, partial outage at half) and merged so
                    overlapping events are never double-counted.
                  </span>
                </li>
                <li>
                  <Basis>manual</Basis>{" "}
                  <span className="text-muted-foreground">
                    — Static components. There is no probe data, so uptime is
                    derived entirely from reported incidents and maintenance.
                  </span>
                </li>
              </ul>
              <p className="text-muted-foreground">
                If a page has uptime display turned off, snapshots are still
                recorded but the percentages stay hidden.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
