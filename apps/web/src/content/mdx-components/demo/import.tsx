import { Button } from "@openstatus/ui/components/ui/button";

import { demo } from "@/data/demo-data";

import {
  Cell,
  CellDescription,
  CellFooter,
  CellGrid,
  CellGridItem,
  CellHeader,
  CellRow,
  CellTitle,
} from "./cell";

/** Paste a key, preview the counts, confirm. Nothing is written before that. */
export function ImportDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Import from {demo.import.provider}</CellTitle>
        <CellDescription>preview</CellDescription>
      </CellHeader>
      <CellRow className="justify-start gap-2 text-xs">
        <span className="text-muted-foreground">API key</span>
        <span className="border-input flex-1 border px-2 py-1">
          ••••••••••••••••7f2a
        </span>
      </CellRow>
      <CellGrid cols={2} sm={3} className="text-xs">
        {demo.import.counts.map((row) => (
          <CellGridItem key={row.label} className="flex justify-between gap-2">
            <span>{row.label}</span>
            <span className="text-foreground">
              {row.value.toLocaleString("en-US")}
            </span>
          </CellGridItem>
        ))}
      </CellGrid>
      <CellFooter>
        <span>Nothing is written until you confirm.</span>
        <Button size="sm" className="rounded-none">
          Import
        </Button>
      </CellFooter>
    </Cell>
  );
}
