import { StatusBanner } from "@openstatus/ui/components/blocks/status-banner";
import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { StatusComponentGroup } from "@openstatus/ui/components/blocks/status-component-group";
import {
  StatusPageHeader,
  StatusPageHeaderActions,
  StatusPageHeaderBrand,
  StatusPageHeaderBrandButton,
  StatusPageHeaderBrandFallback,
  StatusPageHeaderContent,
  StatusPageHeaderNav,
  StatusPageHeaderNavItem,
} from "@openstatus/ui/components/blocks/status-page-header";
import {
  StatusPageMain,
  StatusPageShell,
} from "@openstatus/ui/components/blocks/status-page-shell";
import {
  StatusUpdates,
  StatusUpdatesContent,
  StatusUpdatesJson,
  StatusUpdatesRss,
  StatusUpdatesSlack,
  StatusUpdatesSsh,
  StatusUpdatesTrigger,
} from "@openstatus/ui/components/blocks/status-updates";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";

import { demo, getStatusBarData } from "@/data/demo-data";

import { Cell, CellFooter } from "./cell";
import { SubscribeEmailTab } from "./subscribe-email";

const feed = `https://${demo.company.domain}/feed`;

type Monitor = (typeof demo.components)[number];

const worst = (list: Monitor[]) =>
  list.some((m) => m.status === "degraded") ? "degraded" : "success";

function MonitorCard({ monitor }: { monitor: Monitor }) {
  const data = getStatusBarData(monitor.degradedDays);
  return (
    <StatusComponent variant={monitor.status}>
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentTitle>{monitor.name}</StatusComponentTitle>
        </StatusComponentHeaderLeft>
        <StatusComponentHeaderRight>
          <StatusComponentUptime>{monitor.uptime}</StatusComponentUptime>
          <StatusComponentStatus />
        </StatusComponentHeaderRight>
      </StatusComponentHeader>
      <StatusComponentBody>
        <StatusBar data={data} />
        <StatusComponentFooter data={data} />
      </StatusComponentBody>
    </StatusComponent>
  );
}

/** The live status page, mid-incident: real blocks, no screenshot. */
export function StatusPageDemo() {
  const monitors = demo.components.filter((c) => !c.external);
  const groups = [...new Set(monitors.map((m) => m.group))].map((name) => ({
    name,
    monitors: monitors.filter((m) => m.group === name),
  }));
  const status = worst(monitors);
  return (
    <Cell>
      <StatusPageShell className="min-h-0 gap-0 px-4">
        <StatusPageHeader>
          <StatusPageHeaderContent className="max-w-none px-4">
            <StatusPageHeaderBrand className="w-auto">
              <StatusPageHeaderBrandButton>
                <span>
                  <StatusPageHeaderBrandFallback title={demo.company.name} />
                </span>
              </StatusPageHeaderBrandButton>
            </StatusPageHeaderBrand>
            <StatusPageHeaderNav className="hidden sm:flex">
              <StatusPageHeaderNavItem isActive>
                <span>Status</span>
              </StatusPageHeaderNavItem>
              <StatusPageHeaderNavItem>
                <span>Events</span>
              </StatusPageHeaderNavItem>
              <StatusPageHeaderNavItem className="hidden sm:inline-flex">
                <span>Monitors</span>
              </StatusPageHeaderNavItem>
            </StatusPageHeaderNav>
            <StatusPageHeaderActions className="min-w-0">
              <StatusUpdates>
                <StatusUpdatesTrigger />
                <StatusUpdatesContent>
                  <Tabs defaultValue="email">
                    <TabsList className="w-full rounded-none border-b">
                      <TabsTrigger value="email">Email</TabsTrigger>
                      <TabsTrigger value="slack">Slack</TabsTrigger>
                      <TabsTrigger value="rss">RSS</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                      <TabsTrigger value="ssh">SSH</TabsTrigger>
                    </TabsList>
                    <TabsContent value="email" className="flex flex-col gap-2">
                      <SubscribeEmailTab />
                    </TabsContent>
                    <TabsContent value="slack">
                      <StatusUpdatesSlack rssUrl={`${feed}/rss`} />
                    </TabsContent>
                    <TabsContent value="rss">
                      <StatusUpdatesRss
                        rssUrl={`${feed}/rss`}
                        atomUrl={`${feed}/atom`}
                      />
                    </TabsContent>
                    <TabsContent value="json">
                      <StatusUpdatesJson url={`${feed}/json`} />
                    </TabsContent>
                    <TabsContent value="ssh">
                      <StatusUpdatesSsh
                        command={`ssh ${demo.company.slug}@ssh.openstatus.dev`}
                      />
                    </TabsContent>
                  </Tabs>
                </StatusUpdatesContent>
              </StatusUpdates>
            </StatusPageHeaderActions>
          </StatusPageHeaderContent>
        </StatusPageHeader>
        <StatusPageMain className="max-w-none gap-6 px-3 py-4">
          <StatusBanner status={status} />
          <div className="flex flex-col gap-5">
            {groups.map((group) => {
              const groupStatus = worst(group.monitors);
              return (
                <StatusComponentGroup
                  key={group.name}
                  title={group.name}
                  status={groupStatus}
                  defaultOpen={groupStatus !== "success"}
                >
                  {group.monitors.map((monitor) => (
                    <MonitorCard key={monitor.name} monitor={monitor} />
                  ))}
                </StatusComponentGroup>
              );
            })}
          </div>
        </StatusPageMain>
      </StatusPageShell>
      <CellFooter>
        <span>
          powered by <span className="text-foreground">openstatus</span>
        </span>
        <span>{demo.company.domain}</span>
      </CellFooter>
    </Cell>
  );
}
