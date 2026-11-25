import {
  StatusComponent,
  StatusComponentDescription,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { StatusComponentGroup } from "@openstatus/ui/components/blocks/status-component-group";

import { demo, getGroups, getMonitors } from "@/data/demo-data";

import { Cell, CellBody, CellDescription, CellHeader, CellTitle } from "./cell";

/** Monitors fill in from checks; external services are set by hand; both group. */
export function ComponentsDemo() {
  const monitors = getMonitors().length;
  const external = demo.components.length - monitors;
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Components</CellTitle>
        <CellDescription>
          {monitors} monitors · {external} external
        </CellDescription>
      </CellHeader>
      {/* The group block pulls itself out by 12px; pad so it lands on the cell gutter. */}
      <CellBody className="flex flex-col gap-3 px-7">
        {getGroups().map((group) => (
          <StatusComponentGroup
            key={group.name}
            title={group.name}
            status={group.status}
            defaultOpen
          >
            {group.items.map((c) => {
              const external = "external" in c && c.external;
              return (
                <StatusComponent key={c.name} variant={c.status}>
                  <StatusComponentHeader>
                    <StatusComponentHeaderLeft>
                      <StatusComponentIcon />
                      <StatusComponentTitle>{c.name}</StatusComponentTitle>
                      <StatusComponentDescription
                        aria-label={
                          external ? "External service" : "Monitored service"
                        }
                      >
                        {external ? "external" : "monitor"}
                      </StatusComponentDescription>
                    </StatusComponentHeaderLeft>
                    <StatusComponentHeaderRight>
                      {external ? null : (
                        <StatusComponentUptime>
                          {c.uptime}
                        </StatusComponentUptime>
                      )}
                      <StatusComponentStatus />
                    </StatusComponentHeaderRight>
                  </StatusComponentHeader>
                </StatusComponent>
              );
            })}
          </StatusComponentGroup>
        ))}
      </CellBody>
    </Cell>
  );
}
