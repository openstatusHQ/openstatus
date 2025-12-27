import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusBanner } from "@/components/status-page/status-banner";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { monitors } from "@/data/monitors";

export default function StatusMonitorPlayground({
  className,
  ...props
}: React.ComponentProps<"div"> & {}) {
  const trpc = useTRPC();
  const { data: uptimeData, isLoading } = useQuery(
    trpc.statusPage.getNoopUptime.queryOptions(),
  );
  return (
    // NOTE: we use pointer-events-none to prevent the hover card or tooltip from being interactive - the Portal container is document body and we loose the styles
    <div className={cn("h-full w-full", className)} {...props}>
      <Status variant="success">
        <StatusHeader>
          <StatusTitle>Acme Inc.</StatusTitle>
          <StatusDescription>
            Get informed about our services.
          </StatusDescription>
        </StatusHeader>
        <StatusBanner status="success" />
        <StatusContent>
          {/* TODO: create mock data */}
          <StatusMonitor
            status="success"
            data={uptimeData?.data || []}
            monitor={monitors[0]}
            showUptime={true}
            uptime={uptimeData?.uptime}
            isLoading={isLoading}
          />
        </StatusContent>
      </Status>
    </div>
  );
}
