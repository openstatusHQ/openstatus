import {
  atTime,
  capitalize,
  demo,
  getIncidentDay,
  getStatusBarData,
  sshCommand,
} from "@/data/demo-data";

import { Cell, CellDescription, CellHeader, CellPre, CellTitle } from "./cell";

const title = `${demo.company.name} Status`;
const degradedLabel = demo.locales[0].systemStatus.degraded.long;
const degraded = demo.components.filter((c) => c.status === "degraded");
const identified = demo.incident.updates[1];

// The SSH view, footer trimmed.
const ssh = `$ ${sshCommand}

  ▲  ${degradedLabel}
  ${title}

  ${demo.components.length} components · ${degraded.length} degraded`;

/** The page for terminals and agents: SSH output and the markdown view. */
export function TerminalDemo() {
  const stamp = atTime(getIncidentDay(), identified.time).toLocaleString(
    "en-US",
    {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
  const component = demo.components[0];
  const days = getStatusBarData(component).slice(-31);
  const bar = days
    .map((d) => (d.bar.every((s) => s.status === "success") ? "+" : "~"))
    .join("");
  const markdown = `# ${title}

\`~\` **Degraded** · ${stamp} (GMT+0)

## Active incidents

- x **${demo.incident.title}** — ${capitalize(identified.status)} · affects: ${demo.incident.affected.join(", ")}

## Components

**${component.name}** — ${component.uptime} · \`${days.length}d ago → today\`
\`${bar}\``;
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
