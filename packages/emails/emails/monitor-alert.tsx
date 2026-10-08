/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { CodeBlock } from "./_components/code-block";
import { Footer } from "./_components/footer";
import { formatDateTime } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue, type KeyValueRow } from "./_components/key-value";
import { Layout } from "./_components/layout";
import type { Tone } from "./_components/styles";

const MonitorAlertSchema = z.object({
  type: z.enum(["degraded", "alert", "recovery"]),
  monitorId: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
  status: z.string().optional(),
  latency: z.string().optional(),
  region: z.string().optional(),
  /** Regions in this state / regions the monitor runs in. */
  affectedRegions: z.number().optional(),
  totalRegions: z.number().optional(),
  timestamp: z.string().optional(),
  message: z.string().optional(),
  /** Latency threshold in ms (`monitor.degradedAfter`). */
  degradedAfter: z.number().optional(),
  /** Incident `startedAt`, ISO string. */
  firstSeen: z.string().optional(),
});

export type MonitorAlertProps = z.infer<typeof MonitorAlertSchema>;

const APP_URL = "https://app.openstatus.dev";

const states = {
  alert: { tone: "danger", pill: "Down" },
  degraded: { tone: "warning", pill: "Degraded" },
  recovery: { tone: "success", pill: "Recovered" },
} satisfies Record<MonitorAlertProps["type"], { tone: Tone; pill: string }>;

function hasValue(value?: string): value is string {
  return Boolean(value) && value !== "N/A";
}

function regionCount(props: MonitorAlertProps) {
  return props.affectedRegions && props.totalRegions
    ? `${props.affectedRegions}/${props.totalRegions}`
    : undefined;
}

function from(props: MonitorAlertProps) {
  const count = regionCount(props);
  if (count && props.affectedRegions !== 1) return ` from ${count} regions`;
  return hasValue(props.region) ? ` from ${props.region}` : "";
}

export function monitorAlertSubject(props: MonitorAlertProps): string {
  const name = props.name ?? "Your monitor";
  const latency = hasValue(props.latency) ? props.latency : undefined;
  switch (props.type) {
    case "alert":
      return `${name} is down — ${
        props.status ? `status ${props.status}` : "check failed"
      }${from(props)}`;
    case "degraded":
      return `${name} is slow — ${latency ?? "degraded"}${from(props)}`;
    case "recovery":
      return `${name} recovered — ${latency ?? "passing"}${from(props)}`;
  }
}

export function monitorAlertPreheader(props: MonitorAlertProps): string {
  switch (props.type) {
    case "alert":
      return "Open the monitor for the full response.";
    case "degraded":
      return props.degradedAfter
        ? `Above your ${props.degradedAfter} ms threshold.`
        : "Response time is above your threshold.";
    case "recovery":
      return "Checks are passing again. No action needed.";
  }
}

function title(props: MonitorAlertProps) {
  const name = props.name ?? "Your monitor";
  if (props.type === "alert") return `${name} is down`;
  if (props.type === "degraded") return `${name} is answering slowly`;
  return `${name} is back up`;
}

function lede(props: MonitorAlertProps) {
  if (props.type === "alert") {
    return `A check${from(props)} failed${
      props.status ? ` with status ${props.status}` : ""
    }.`;
  }
  if (props.type === "degraded") {
    return `Latency crossed your ${
      props.degradedAfter ? `${props.degradedAfter} ms ` : ""
    }threshold${from(props)}.${
      props.status ? ` The endpoint is still returning ${props.status}.` : ""
    }`;
  }
  return `Checks${from(props)} are passing again. No action needed.`;
}

const MonitorAlertEmail = (props: MonitorAlertProps) => {
  const state = states[props.type];
  const monitorUrl = props.monitorId
    ? `${APP_URL}/monitors/${props.monitorId}`
    : `${APP_URL}/monitors`;

  const rows: KeyValueRow[] = [];
  if (hasValue(props.latency)) {
    rows.push({
      label: "Latency",
      value: props.latency,
      tone: props.type === "degraded" ? "warning" : undefined,
      hint:
        props.type === "degraded" && props.degradedAfter
          ? `threshold ${props.degradedAfter} ms`
          : undefined,
    });
  }
  // no status code for TCP / DNS monitors
  if (props.status) {
    rows.push({
      label: "Response",
      value: props.status,
      mono: true,
      tone: props.type === "alert" ? "danger" : undefined,
    });
  }
  if (props.url) {
    rows.push({
      label: "Request",
      value: [props.method, props.url].filter(Boolean).join(" "),
      mono: true,
    });
  }
  const count = regionCount(props);
  if (count) {
    rows.push({
      label: "Regions",
      value: count,
      hint:
        props.affectedRegions === 1 && hasValue(props.region)
          ? props.region
          : undefined,
    });
  } else if (hasValue(props.region)) {
    rows.push({ label: "Region", value: props.region });
  }
  if (props.firstSeen) {
    rows.push({ label: "First seen", value: formatDateTime(props.firstSeen) });
  }
  if (props.timestamp) {
    rows.push({ label: "Checked at", value: formatDateTime(props.timestamp) });
  }

  return (
    <Layout
      preview={monitorAlertPreheader(props)}
      pill={{ tone: state.tone, label: state.pill }}
      footer={
        <Footer
          rule={
            props.type === "degraded" && props.degradedAfter
              ? `latency > ${props.degradedAfter}ms`
              : undefined
          }
          reason="You get this because this address is a notification channel for the monitor."
          links={
            props.monitorId && props.type === "degraded" && props.degradedAfter
              ? [{ label: "Edit rule", href: `${monitorUrl}/edit` }]
              : []
          }
        />
      }
    >
      <Heading title={title(props)}>{lede(props)}</Heading>
      <KeyValue rows={rows} />
      {props.message ? (
        <CodeBlock>
          {props.message.length > 400
            ? `${props.message.slice(0, 400)}…`
            : props.message}
        </CodeBlock>
      ) : null}
      <Actions
        primary={{ label: "Open monitor", href: monitorUrl }}
        secondary={
          props.monitorId
            ? { label: "Edit notifications", href: `${monitorUrl}/edit` }
            : undefined
        }
      />
    </Layout>
  );
};

MonitorAlertEmail.PreviewProps = {
  type: "degraded",
  monitorId: 1,
  name: "Ping Pong",
  url: "https://openstatus.dev/ping",
  method: "GET",
  status: "200",
  latency: "300 ms",
  region: "Amsterdam, Netherlands",
  affectedRegions: 5,
  totalRegions: 6,
  timestamp: "2026-10-13T17:32:00Z",
  firstSeen: "2026-10-13T17:29:00Z",
  degradedAfter: 250,
  message: "upstream response time 0.302s, cache: MISS",
} satisfies MonitorAlertProps;

export default MonitorAlertEmail;
