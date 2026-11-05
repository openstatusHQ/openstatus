import { StatusBanner } from "@openstatus/ui/components/blocks/status-banner";
import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { StatusComponentGroup } from "@openstatus/ui/components/blocks/status-component-group";
import {
  StatusPageFooter,
  StatusPageFooterContent,
  StatusPagePoweredBy,
} from "@openstatus/ui/components/blocks/status-page-footer";
import {
  StatusPageHeader,
  StatusPageHeaderActions,
  StatusPageHeaderBrand,
  StatusPageHeaderBrandButton,
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
  StatusUpdatesTrigger,
} from "@openstatus/ui/components/blocks/status-updates";
import Image from "next/image";

import {
  type DemoComponent,
  demo,
  getGroups,
  getMonitors,
  getStatusBarData,
  worstStatus,
} from "@/data/demo-data";

import { Cell } from "./cell";
import { SubscribeTabs } from "./subscribe";

function MonitorCard({ component }: { component: DemoComponent }) {
  const data = getStatusBarData(component);
  return (
    <StatusComponent variant={component.status}>
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentTitle>{component.name}</StatusComponentTitle>
        </StatusComponentHeaderLeft>
        <StatusComponentHeaderRight>
          <StatusComponentUptime>{component.uptime}</StatusComponentUptime>
          <StatusComponentIcon />
        </StatusComponentHeaderRight>
      </StatusComponentHeader>
      <StatusComponentBody>
        <StatusBar data={data} />
        <StatusComponentFooter data={data} />
      </StatusComponentBody>
    </StatusComponent>
  );
}

/** The live status page while a component is degraded: real blocks, no screenshot. */
export function StatusPageDemo() {
  const monitors = getMonitors();
  const groups = getGroups(monitors);
  return (
    <Cell>
      <StatusPageShell className="min-h-0 gap-0 px-4">
        <StatusPageHeader>
          <StatusPageHeaderContent className="max-w-none px-4">
            <StatusPageHeaderBrand className="w-auto">
              <StatusPageHeaderBrandButton>
                <span>
                  <Image
                    src={demo.company.icon}
                    alt={demo.company.name}
                    width={32}
                    height={32}
                    className="size-8"
                  />
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
              <StatusPageHeaderNavItem>
                <span>Monitors</span>
              </StatusPageHeaderNavItem>
            </StatusPageHeaderNav>
            <StatusPageHeaderActions className="min-w-0">
              <StatusUpdates>
                <StatusUpdatesTrigger />
                <StatusUpdatesContent>
                  <SubscribeTabs />
                </StatusUpdatesContent>
              </StatusUpdates>
            </StatusPageHeaderActions>
          </StatusPageHeaderContent>
        </StatusPageHeader>
        {/* The group block pulls itself out by 12px; pad so it lands on the cell gutter. */}
        <StatusPageMain className="max-w-none gap-6 px-3 py-4">
          <StatusBanner status={worstStatus(monitors)} />
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <StatusComponentGroup
                key={group.name}
                title={group.name}
                status={group.status}
                defaultOpen={group.status !== "success"}
              >
                {group.items.map((component) => (
                  <MonitorCard key={component.name} component={component} />
                ))}
              </StatusComponentGroup>
            ))}
          </div>
        </StatusPageMain>
      </StatusPageShell>
      <StatusPageFooter>
        <StatusPageFooterContent className="max-w-none px-4">
          <StatusPagePoweredBy>
            <span className="text-foreground">openstatus</span>
          </StatusPagePoweredBy>
          <span className="text-muted-foreground text-xs">
            {demo.company.domain}
          </span>
        </StatusPageFooterContent>
      </StatusPageFooter>
    </Cell>
  );
}
