"use client";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { SidebarRight } from "@/components/nav/sidebar-right";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { CircleCheck, Logs } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatMilliseconds } from "@/lib/formatter";

export function Sidebar() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: parseInt(id) })
  );

  if (!monitor) return null;

  return (
    <SidebarRight
      header="Monitor"
      metadata={[
        {
          label: "Overview",
          items: [
            {
              label: "Status",
              value: <span className="text-success">Normal</span>,
            },
            { label: "Next run", value: "5m" },
            {
              label: "Type",
              value: <span className="uppercase">{monitor.jobType}</span>,
            },
            {
              label: "Tags",
              value: ["API", "Production"].map((tag) => (
                <Badge key={tag} variant="secondary" className="mr-1 py-0">
                  {tag}
                </Badge>
              )),
            },
          ],
        },
        {
          label: "Configuration",
          items: [
            { label: "Periodicity", value: monitor.periodicity },
            {
              label: "Timeout",
              value: formatMilliseconds(monitor.timeout),
            },
            { label: "Public", value: String(monitor.public) },
          ],
        },
        {
          label: "Notifiers",
          items: monitor.notifications.flatMap((notification) => {
            const arr = [];
            arr.push({
              label: "Name",
              value: (
                <TableCellLink
                  href={`/notifiers/${notification.id}`}
                  value={notification.name}
                />
              ),
            });
            arr.push({
              label: "Type",
              value: notification.provider,
              isNested: true,
            });
            arr.push({
              label: "Value",
              value: notification.data, // TODO: improve this based on the provider
              isNested: true,
            });
            return arr;
          }),
        },
        {
          label: "Last Logs",
          items: [
            ...Array.from({ length: 20 }).map((_, index) => {
              const date = new Date(new Date().getTime() - index * 500000);
              return {
                label: [
                  "Amsterdam",
                  "Frankfurt",
                  "New York",
                  "Singapore",
                  "Johannesburg",
                ][index % 5],
                value: (
                  <div className="flex items-center justify-between gap-2">
                    <CircleCheck className="h-4 w-4 text-success" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="underline decoration-muted-foreground/50 decoration-dashed underline-offset-2">
                            {date.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent align="center" side="left">
                          {date.toLocaleString("en-US")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ),
              };
            }),
          ],
        },
      ]}
      footerButton={{
        onClick: () => router.push("/dashboard/monitors/logs"),
        children: (
          <>
            <Logs />
            <span>View all logs</span>
          </>
        ),
      }}
    />
  );
}
