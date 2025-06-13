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
import { monitors } from "@/data/monitors";
import { statusPages } from "@/data/status-pages";
import { ExternalLink } from "lucide-react";

// NOTE:
const BADGE_URL =
  "https://openstatus.dev/status-page/hello-world/badge?size=sm&theme=light";

const statusPage = statusPages[0];

export function Sidebar() {
  return (
    <SidebarRight
      header="Status Page"
      metadata={[
        {
          label: "Overview",
          items: [
            {
              label: "Slug",
              value: <Link href="#">{statusPage.slug}</Link>,
            },
            { label: "Domain", value: statusPage.domain },
            {
              label: "Favicon",
              value: (
                <div className="size-4 overflow-hidden rounded border bg-muted">
                  <img src={statusPage.favicon} alt="favicon" />
                </div>
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
              value: <TableCellBoolean value={statusPage.protected} />,
            },
            {
              label: "Show values",
              value: <TableCellBoolean value={statusPage.showValues} />,
            },
          ],
        },
        {
          label: "Monitors",
          items: monitors
            // NOTE: only show the first 2 monitors
            .slice(0, 2)
            .flatMap((monitor) => {
              const arr = [];
              const url = new URL(monitor.url);
              arr.push({
                label: "Name",
                value: (
                  <TableCellLink
                    href="/dashboard/monitors/overview"
                    value={monitor.name}
                  />
                ),
              });
              arr.push({
                label: "URL",
                value: `${url.hostname}${url.pathname}`,
                isNested: true,
              });
              return arr;
            }),
          // items: [
          //   {
          //     label: "Name",
          //     value: (
          //       <TableCellLink
          //         href="/dashboard/monitors/overview"
          //         value={monitor.name}
          //       />
          //     ),
          //   },
          //   {
          //     label: "URL",
          //     value: monitor.url,
          //     isNested: true,
          //   },
          // ],
        },
      ]}
      footerButton={{
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
