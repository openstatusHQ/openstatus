import { demo } from "@/data/demo-data";

import { Cell, CellDescription, CellHeader, CellPre, CellTitle } from "./cell";

const title = `${demo.company.name} Status`;
const degraded = demo.components.filter((c) => c.status === "degraded");

// Mirrors the live TUI at ssh.openstatus.dev, footer trimmed.
const ssh = `$ ssh ${demo.company.slug}@ssh.openstatus.dev

  ▲  Degraded Performance
  ${title}

  ${demo.components.length} components · ${degraded.length} degraded`;

// Mirrors `generateOverview` in apps/status-page/src/content/markdown,
// cut after the first component.
const markdown = `# ${title}

\`~\` **Degraded** · Sep 27, 2026 ${demo.incident.updates[1].time} (GMT+0)

## Active incidents

- x **${demo.incident.title}** — Identified · affects: ${demo.incident.affected.join(", ")}

## Components

**${demo.components[0].name}** — ${demo.components[0].uptime} · \`30d ago → today\`
\`+++++++++++++++++++++~++++++++~\``;

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
        <CellTitle>{demo.company.domain}/.md</CellTitle>
        <CellDescription>markdown</CellDescription>
      </CellHeader>
      <CellPre>{markdown}</CellPre>
    </Cell>
  );
}
