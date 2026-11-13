/** @jsxRuntime automatic @jsxImportSource react */

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { plural } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";

export interface MonitorSlaMissedProps {
  policyName: string;
  /** YYYY-MM-01 */
  month: string;
  workspaceName: string;
  /** uptime and target in thousandths of a percent */
  monitors: { name: string; uptime: number; target: number }[];
  url: string;
}

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatSlaMonth(month: string): string {
  const date = new Date(`${month.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? month : monthLabel.format(date);
}

/** "99.120%": floored to three decimals, so a miss never rounds up. */
export function formatSlaUptime(thousandths: number): string {
  const whole = Math.floor(thousandths / 1000);
  const rest = String(thousandths % 1000).padStart(3, "0");
  return `${whole}.${rest}%`;
}

/** "99.5%": a target without trailing zeros. */
export function formatSlaTarget(thousandths: number): string {
  return formatSlaUptime(thousandths).replace(/\.?0+%$/, "%");
}

function missedWho(props: Pick<MonitorSlaMissedProps, "monitors">): string {
  return props.monitors.length === 1
    ? props.monitors[0].name
    : plural(props.monitors.length, "monitor");
}

export function monitorSlaMissedSubject(
  props: Pick<MonitorSlaMissedProps, "policyName" | "month" | "monitors">,
): string {
  return `${missedWho(props)} missed ${props.policyName} in ${formatSlaMonth(props.month)}`;
}

const MonitorSlaMissedEmail = (props: MonitorSlaMissedProps) => {
  const month = formatSlaMonth(props.month);
  return (
    <Layout
      preview={`${month} is sealed. ${plural(props.monitors.length, "monitor")} finished below target.`}
      pill={{ tone: "danger", label: "Target missed" }}
      footer={<Footer reason="You get this because you own this workspace." />}
    >
      <Heading title={monitorSlaMissedSubject(props)}>
        {`${month} is sealed for this policy in ${props.workspaceName}, and ${props.monitors.length === 1 ? "this monitor" : "these monitors"} finished below target. A sealed month keeps the counts and terms it was sealed with; editing the policy no longer changes it.`}
      </Heading>
      <KeyValue
        rows={props.monitors.map((m) => ({
          label: m.name,
          value: formatSlaUptime(m.uptime),
          hint: `target ${formatSlaTarget(m.target)}`,
          tone: "danger",
          mono: true,
        }))}
      />
      <Actions primary={{ label: "Open policy", href: props.url }} />
    </Layout>
  );
};

MonitorSlaMissedEmail.PreviewProps = {
  policyName: "Partner contract",
  month: "2026-10-01",
  workspaceName: "Acme",
  monitors: [
    { name: "Checkout API", uptime: 99_120, target: 99_500 },
    { name: "Auth", uptime: 98_004, target: 99_500 },
  ],
  url: "https://app.openstatus.dev/reportings/monitors/1",
} satisfies MonitorSlaMissedProps;

export default MonitorSlaMissedEmail;
