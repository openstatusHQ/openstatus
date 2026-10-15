"use client";

import { deserialize } from "@openstatus/assertions";
import { Logs } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { SidebarRight } from "@/components/nav/sidebar-right";
import { monitorTypes } from "@/data/monitors.client";
import { formatMilliseconds } from "@/lib/formatter";
import { buildMonitorBadgeUrl } from "@/lib/monitor-badge";
import { useTRPC } from "@/lib/trpc/client";

export function Sidebar() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const isPublic = Boolean(monitor?.public);
  const { data: pageComponents } = useQuery({
    ...trpc.pageComponent.list.queryOptions(),
    enabled: isPublic,
  });
  const { data: statusPages } = useQuery({
    ...trpc.page.list.queryOptions(),
    enabled: isPublic,
  });
  const { copy } = useCopyToClipboard();

  if (!monitor) return null;

  const statusPage = monitor.public
    ? statusPages?.find(
        (p) =>
          p.accessType === "public" &&
          pageComponents?.some(
            (c) => c.monitorId === monitor.id && c.pageId === p.id,
          ),
      )
    : undefined;

  const BADGE_URL = statusPage
    ? buildMonitorBadgeUrl(statusPage, monitor.id)
    : null;

  const assertions = monitor.assertions ? deserialize(monitor.assertions) : [];
  const type = monitorTypes.find((type) => type.id === monitor.jobType);

  return (
    <SidebarRight
      header="Monitor"
      metadata={[
        {
          label: "Overview",
          items: [
            {
              label: "External Name",
              value: monitor.externalName || monitor.name,
            },
            {
              label: "Status",
              value: (
                <span
                  className={
                    monitor.status === "error"
                      ? "text-destructive"
                      : monitor.status === "degraded"
                        ? "text-warning"
                        : "text-success"
                  }
                >
                  {monitor.status.charAt(0).toUpperCase() +
                    monitor.status.slice(1)}
                </span>
              ),
            },
            {
              label: "Type",
              value: type ? (
                <span className="flex items-center gap-1">
                  <span>{type.label}</span>
                  <type.icon className="text-muted-foreground h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="uppercase">{monitor.jobType}</span>
              ),
            },
            {
              label: "Endpoint",
              value: monitor.url.replace(/^https?:\/\//, ""),
            },
            {
              label: "Regions",
              value: (() => {
                const allRegions = [
                  ...monitor.regions,
                  ...(monitor.privateLocations?.map((location) =>
                    location.id.toString(),
                  ) ?? []),
                ];
                // Sort regions: numeric sort for private location IDs, alphabetic for region codes
                const sortedRegions = allRegions.sort((a, b) => {
                  const aNum = Number(a);
                  const bNum = Number(b);
                  // If both are numeric, sort numerically
                  if (!isNaN(aNum) && !isNaN(bNum)) {
                    return aNum - bNum;
                  }
                  // Otherwise, sort alphabetically
                  return a.localeCompare(b);
                });
                return sortedRegions.length > 6
                  ? `${sortedRegions.length} regions`
                  : sortedRegions.join(", ");
              })(),
            },
            {
              label: "Tags",
              value: (
                <div className="group/badges flex flex-wrap -space-x-2">
                  {monitor.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="bg-background relative flex translate-x-0 items-center gap-1.5 rounded-full transition-transform hover:z-10 hover:translate-x-1"
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
            {
              label: "Badge",
              value: BADGE_URL ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="align-middle">
                      <img
                        className="h-5 rounded-sm border"
                        src={BADGE_URL}
                        alt="badge"
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      className="cursor-pointer"
                      side="left"
                      onClick={() => copy(BADGE_URL, { withToast: true })}
                    >
                      {BADGE_URL}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                "-"
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
            {
              label: "Follow redirects",
              value: String(monitor.followRedirects),
            },
          ],
        },
        {
          label: "Notifications",
          emptyMessage: "No notifications attached",
          items: monitor.notifications.flatMap((notification) => {
            const arr = [];
            arr.push({
              label: "Name",
              value: (
                <TableCellLink
                  // TODO: add the ?id= to the href and open the sheet
                  href={"/notifications"}
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
          emptyMessage: "No assertions configured",
          items: assertions.flatMap((assertion) => {
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
              (assertion.schema.type === "header" ||
                assertion.schema.type === "dnsRecord") &&
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
          }),
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
