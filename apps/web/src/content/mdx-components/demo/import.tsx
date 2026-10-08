import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";

import { demo, formatNumber } from "@/data/demo-data";

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
        <Input
          readOnly
          defaultValue={demo.import.apiKey}
          aria-label="API key"
          className="h-7 flex-1 text-xs"
        />
      </CellRow>
      <CellGrid cols={2} sm={3} className="text-xs">
        {demo.import.counts.map((row) => (
          <CellGridItem key={row.label} className="flex justify-between gap-2">
            <span>{row.label}</span>
            <span className="text-foreground">{formatNumber(row.value)}</span>
          </CellGridItem>
        ))}
      </CellGrid>
      <CellFooter>
        <span>Nothing is written until you confirm.</span>
        <Button type="button" size="sm">
          Import
        </Button>
      </CellFooter>
    </Cell>
  );
}
