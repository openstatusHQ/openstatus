import { demo } from "@/data/demo-data";

import {
  Cell,
  CellDescription,
  CellHeader,
  CellPre,
  CellRow,
  CellTitle,
  toneClass,
} from "./cell";

const command = `docker run -d --name openstatus-probe \\
  --restart=always \\
  -e OPENSTATUS_KEY=os_•••••••• \\
  ${demo.privateLocation.image}`;

/** One container inside the network; it shows up as one more region. */
export function PrivateLocationDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>terminal</CellTitle>
        <CellDescription>
          {demo.privateLocation.imageSize} image · arm64 and amd64
        </CellDescription>
      </CellHeader>
      <CellPre>{command}</CellPre>
      {demo.privateLocation.probes.map((probe) => (
        <CellRow key={probe.name} className="text-xs">
          <span>
            {probe.name}{" "}
            <span className="text-muted-foreground">{probe.ip}</span>
          </span>
          <span className={toneClass.success}>online · {probe.seen}</span>
        </CellRow>
      ))}
    </Cell>
  );
}
