"use client";

import { Link } from "@/components/common/link";
import { TableCellBoolean } from "@/components/data-table/table-cell-boolean";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { SidebarRight } from "@/components/nav/sidebar-right";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";

// NOTE:
const BADGE_URL =
  "https://openstatus.dev/status-page/hello-world/badge?size=sm&theme=light";

export function Sidebar() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: parseInt(id) })
  );

  if (!statusPage) return null;

  return (
    <SidebarRight
      header="Status Page"
      metadata={[
        {
          label: "Overview",
          items: [
            {
              label: "Slug",
              value: (
                <Link
                  href={`https://${statusPage.customDomain || `${statusPage.slug}.openstatus.dev`}`}
                  target="_blank"
                >
                  {statusPage.slug}
                </Link>
              ),
            },
            { label: "Domain", value: statusPage.customDomain || "-" },
            {
              label: "Favicon",
              value: statusPage.icon ? (
                <div className="size-4 overflow-hidden rounded border bg-muted">
                  <img src={statusPage.icon} alt="favicon" />
                </div>
              ) : (
                "-"
              ),
            },
            {
              label: "Badge",
              value: (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="align-middle">
                      <img className="h-5" src={BADGE_URL} />
                    </TooltipTrigger>
                    <TooltipContent>Learn more about the badge.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ),
            },
          ],
        },
        {
          label: "Configuration",
          items: [
            {
              label: "Protected",
              value: <TableCellBoolean value={statusPage.passwordProtected} />,
            },
            {
              label: "Show values",
              value: <TableCellBoolean value={statusPage.showMonitorValues} />,
            },
          ],
        },
        {
          label: "Monitors",
          items: statusPage.monitors.flatMap((monitor) => {
            const arr = [];
            arr.push({
              label: "Name",
              value: (
                <TableCellLink
                  href={`/monitors/${monitor.id}/overview`}
                  value={monitor.name}
                />
              ),
            });
            arr.push({
              label: "URL",
              value: monitor.url,
              isNested: true,
            });
            return arr;
          }),
        },
      ]}
      footerButton={{
        // TODO: onClick
        children: (
          <>
            <ExternalLink />
            <span>Visit Status Page</span>
          </>
        ),
      }}
    />
  );
}
