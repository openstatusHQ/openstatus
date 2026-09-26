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
  ghcr.io/openstatushq/private-location:latest`;

const probes = [
  { name: "vpc-eu-west", ip: "10.0.4.12", seen: "2s ago" },
  { name: "office-berlin", ip: "192.168.1.40", seen: "5s ago" },
];

/** One container inside the network; it shows up as one more region. */
export function PrivateLocationDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>terminal</CellTitle>
        <CellDescription>8.5 MB image · arm64 and amd64</CellDescription>
      </CellHeader>
      <CellPre>{command}</CellPre>
      {probes.map((probe) => (
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
