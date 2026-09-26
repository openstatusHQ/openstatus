import {
  StatusComponent,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { StatusComponentGroup } from "@openstatus/ui/components/blocks/status-component-group";

import { demo } from "@/data/demo-data";

import { Cell, CellBody, CellDescription, CellHeader, CellTitle } from "./cell";

const groups = [...new Set(demo.components.map((c) => c.group))].map((name) => {
  const items = demo.components.filter((c) => c.group === name);
  return {
    name,
    items,
    status: items.some((c) => c.status === "degraded")
      ? ("degraded" as const)
      : ("success" as const),
  };
});

/** Monitors fill in from checks; external services are set by hand; both group. */
export function ComponentsDemo() {
  const monitors = demo.components.filter((c) => !c.external).length;
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
        {groups.map((group) => (
          <StatusComponentGroup
            key={group.name}
            title={group.name}
            status={group.status}
            defaultOpen
          >
            {group.items.map((c) => (
              <StatusComponent key={c.name} variant={c.status}>
                <StatusComponentHeader>
                  <StatusComponentHeaderLeft>
                    <StatusComponentIcon />
                    <StatusComponentTitle>{c.name}</StatusComponentTitle>
                  </StatusComponentHeaderLeft>
                  <StatusComponentHeaderRight>
                    <StatusComponentUptime className="text-muted-foreground text-xs">
                      {c.external
                        ? "external · manual"
                        : `monitor · ${c.uptime}`}
                    </StatusComponentUptime>
                    <StatusComponentStatus />
                  </StatusComponentHeaderRight>
                </StatusComponentHeader>
              </StatusComponent>
            ))}
          </StatusComponentGroup>
        ))}
      </CellBody>
    </Cell>
  );
}
