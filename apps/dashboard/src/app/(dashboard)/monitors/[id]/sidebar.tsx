"use client";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { SidebarRight } from "@/components/nav/sidebar-right";
import { Badge } from "@/components/ui/badge";
import { formatMilliseconds } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { deserialize } from "@openstatus/assertions";
import { useQuery } from "@tanstack/react-query";
import { Logs } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export function Sidebar() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!monitor) return null;

  const assertions = monitor.assertions ? deserialize(monitor.assertions) : [];

  return (
    <SidebarRight
      header="Monitor"
      metadata={[
        {
          label: "Overview",
          items: [
            {
              label: "Status",
              // FIXME: dynamic
              value: <span className="text-success">Normal</span>,
            },
            {
              label: "Type",
              value: <span className="uppercase">{monitor.jobType}</span>,
            },
            {
              label: "Endpoint",
              value: monitor.url.replace(/^https?:\/\//, ""),
            },
            {
              label: "Regions",
              value:
                monitor.regions.length > 6
                  ? `${monitor.regions.length} regions`
                  : monitor.regions.join(", "),
            },
            {
              label: "Tags",
              value: (
                <div className="group/badges -space-x-2 flex flex-wrap">
                  {monitor.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="relative flex translate-x-0 items-center gap-1.5 rounded-full bg-background transition-transform hover:z-10 hover:translate-x-1"
                    >
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              ),
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
            { label: "Active", value: String(monitor.active) },
          ],
        },
        {
          label: "Notifications",
          items: monitor.notifications.flatMap((notification) => {
            const arr = [];
            arr.push({
              label: "Name",
              value: (
                <TableCellLink
                  href={`/notifications/${notification.id}`}
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
              value: notification.data, // TODO: improve this based on the provider - we might wanna parse it!
              isNested: true,
            });
            return arr;
          }),
        },
        {
          label: "Assertions",
          items:
            assertions.length > 0
              ? assertions.flatMap((assertion) => {
                  const arr = [];

                  arr.push({
                    label: "Type",
                    value: assertion.schema.type,
                  });

                  arr.push({
                    label: "Compare",
                    value: assertion.schema.compare,
                    isNested: true,
                  });

                  if (
                    assertion.schema.type === "header" &&
                    assertion.schema.key
                  ) {
                    arr.push({
                      label: "Key",
                      value: assertion.schema.key,
                      isNested: true,
                    });
                  }

                  arr.push({
                    label: "Value",
                    value: assertion.schema.target,
                    isNested: true,
                  });

                  return arr;
                })
              : [],
        },
        // {
        //   label: "Last Logs",
        //   items: [
        //     ...Array.from({ length: 20 }).map((_, index) => {
        //       const date = new Date(new Date().getTime() - index * 500000);
        //       return {
        //         label: [
        //           "Amsterdam",
        //           "Frankfurt",
        //           "New York",
        //           "Singapore",
        //           "Johannesburg",
        //         ][index % 5],
        //         value: (
        //           <div className="flex items-center justify-between gap-2">
        //             <CircleCheck className="h-4 w-4 text-success" />
        //             <TooltipProvider>
        //               <Tooltip>
        //                 <TooltipTrigger>
        //                   <span className="underline decoration-muted-foreground/50 decoration-dashed underline-offset-2">
        //                     {date.toLocaleTimeString("en-US", {
        //                       hour: "2-digit",
        //                       minute: "2-digit",
        //                     })}
        //                   </span>
        //                 </TooltipTrigger>
        //                 <TooltipContent align="center" side="left">
        //                   {date.toLocaleString("en-US")}
        //                 </TooltipContent>
        //               </Tooltip>
        //             </TooltipProvider>
        //           </div>
        //         ),
        //       };
        //     }),
        //   ],
        // },
      ]}
      footerButton={{
        onClick: () => router.push(`/monitors/${id}/logs`),
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
