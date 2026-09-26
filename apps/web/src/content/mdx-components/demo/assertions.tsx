import { demo } from "@/data/demo-data";

import {
  Cell,
  CellDescription,
  CellHeader,
  CellKey,
  CellKeyValues,
  CellRow,
  CellSubheader,
  CellTitle,
  CellValue,
  toneClass,
} from "./cell";

/** The request as configured, and what each assertion decided this run. */
export function AssertionsDemo() {
  const { monitor } = demo;
  return (
    <Cell>
      <CellHeader>
        <CellTitle>
          <span className="text-muted-foreground">{monitor.method}</span>{" "}
          {monitor.url.replace("https://", "")}
        </CellTitle>
        <CellDescription>every {monitor.periodicity}</CellDescription>
      </CellHeader>
      <CellSubheader>Headers</CellSubheader>
      <CellKeyValues className="gap-y-0.5">
        {monitor.headers.map((h) => (
          <div key={h.key} className="contents">
            <CellKey>{h.key}</CellKey>
            <CellValue>{h.value}</CellValue>
          </div>
        ))}
      </CellKeyValues>
      <CellSubheader>Assertions</CellSubheader>
      {monitor.assertions.map((a) => (
        <CellRow key={a.target} className="text-xs">
          <span>
            {a.target}{" "}
            <span className="text-muted-foreground">{a.comparator}</span>{" "}
            {a.value}
          </span>
          <span className={a.pass ? toneClass.success : toneClass.destructive}>
            {a.pass ? "passed" : `failed${"got" in a ? ` · ${a.got}` : ""}`}
          </span>
        </CellRow>
      ))}
      <CellSubheader>Thresholds</CellSubheader>
      <CellRow className="text-xs">
        <span>
          degraded after{" "}
          <span className={toneClass.warning}>
            {monitor.degradedAfter.toLocaleString("en-US")} ms
          </span>
        </span>
        <span>
          timeout{" "}
          <span className={toneClass.destructive}>
            {monitor.timeout.toLocaleString("en-US")} ms
          </span>
        </span>
      </CellRow>
    </Cell>
  );
}
