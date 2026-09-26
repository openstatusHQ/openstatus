import { demo } from "@/data/demo-data";

import { Cell, CellDescription, CellHeader, CellPre, CellTitle } from "./cell";

const ssh = `$ ssh ${demo.company.domain.replace("status.", "")}@ssh.openstatus.dev

  ${demo.company.name} · Degraded Performance

  ▲ ${demo.components[0].name}   ${demo.components[0].uptime}   degraded
  ● ${demo.components[1].name}       ${demo.components[1].uptime}   operational
  ● ${demo.components[3].name}      ${demo.components[3].uptime}     operational
  ● ${demo.components[4].name}           ${demo.components[4].uptime}     operational`;

const markdown = `# ${demo.company.name} status

**Degraded Performance**

## ${demo.incident.title}

- identified · ${demo.incident.updates[1].message}
- investigating · ${demo.incident.updates[0].message}`;

/** The page for terminals and agents: SSH output and the markdown view. */
export function TerminalDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>terminal</CellTitle>
        <CellDescription>ssh</CellDescription>
      </CellHeader>
      <CellPre>{ssh}</CellPre>
      <CellHeader>
        <CellTitle>{demo.company.domain}/status.md</CellTitle>
        <CellDescription>markdown</CellDescription>
      </CellHeader>
      <CellPre>{markdown}</CellPre>
    </Cell>
  );
}
