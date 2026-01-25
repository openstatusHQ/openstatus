"use client";

import { Link } from "@/components/common/link";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { SidebarRight } from "@/components/nav/sidebar-right";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";

export function Sidebar() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { copy } = useCopyToClipboard();

  if (!statusPage) return null;

  const BADGE_URL = `https://${statusPage.slug}.openstatus.dev/badge/v2`;

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
                  href={`https://${
                    statusPage.customDomain ||
                    `${statusPage.slug}.openstatus.dev`
                  }`}
                  target="_blank"
                >
                  {statusPage.slug}
                </Link>
              ),
            },
            {
              label: "Access Type",
              value: statusPage.accessType,
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
              ),
            },
          ],
        },
        {
          label: "Configuration",
          items: [
            {
              label: "Theme",
              value: statusPage.configuration?.theme ?? "-",
            },
            {
              label: "Bar Value",
              value: statusPage.configuration?.type ?? "-",
            },
            {
              label: "Card Value",
              value: statusPage.configuration?.value ?? "-",
            },
            {
              label: "Show Uptime",
              value: statusPage.configuration?.uptime ? "Yes" : "No",
            },
          ],
        },
        {
          label: "Monitors",
          items: statusPage.pageComponents.flatMap((component) => {
            const arr = [];
            arr.push({
              label: "Name",
              value: (
                <TableCellLink
                  href={`status-pages/${statusPage.id}/components`}
                  value={component.name}
                />
              ),
            });
            arr.push({
              label: "Type",
              value: component.type,
              isNested: true,
            });
            return arr;
          }),
        },
      ]}
      footerButton={{
        onClick: () =>
          typeof window !== "undefined" &&
          window.open(
            `https://${
              statusPage.customDomain || `${statusPage.slug}.openstatus.dev`
            }`,
            "_blank",
          ),
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
