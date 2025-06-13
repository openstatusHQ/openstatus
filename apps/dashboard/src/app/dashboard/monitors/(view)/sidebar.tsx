"use client";

import { SidebarRight } from "@/components/nav/sidebar-right";
import {
  TooltipContent,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleCheck, Logs } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { TableCellLink } from "@/components/data-table/table-cell-link";

export function Sidebar() {
  const router = useRouter();
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
            { label: "Type", value: "HTTP" },
            {
              label: "Tags",
              value: ["API", "Production"].map((tag) => (
                <Badge key={tag} variant="secondary" className="py-0 mr-1">
                  {tag}
                </Badge>
              )),
            },
          ],
        },
        {
          label: "Configuration",
          items: [
            { label: "Periodicity", value: "10m" },
            { label: "Timeout", value: "10,000ms" },
            { label: "Public", value: "false" },
          ],
        },
        // {
        //   label: "Integrations",
        //   items: [],
        // },
        {
          label: "Notifiers",
          items: [
            {
              label: "Name",
              value: <TableCellLink href="#" value="Team" />,
            },
            { label: "Type", value: "Email", isNested: true },
            {
              label: "Adress",
              value: "justdoit@openstatus.dev",
              isNested: true,
            },
          ],
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
                  <div className="flex justify-between items-center gap-2">
                    <CircleCheck className="w-4 h-4 text-success" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="underline decoration-dashed underline-offset-2 decoration-muted-foreground/50">
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
