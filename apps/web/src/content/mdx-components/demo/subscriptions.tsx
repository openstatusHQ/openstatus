import { demo, formatNumber } from "@/data/demo-data";

import { Cell, CellDescription, CellHeader, CellTitle } from "./cell";
import { SubscribeTabs } from "./subscribe";

/** The "Get updates" popover as its own cell. */
export function SubscriptionsDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Get updates</CellTitle>
        <CellDescription>
          {formatNumber(demo.subscribers.email)} email subscribers
        </CellDescription>
      </CellHeader>
      <SubscribeTabs />
    </Cell>
  );
}
