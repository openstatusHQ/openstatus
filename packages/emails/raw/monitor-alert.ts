import { renderTemplateWithFooter } from "./_components";

interface MonitorAlertEmailProps {
  name?: string;
  type: "alert" | "degraded" | "recovery";
  url?: string;
  status?: string;
  latency?: string;
  region?: string;
  timestamp?: string;
  message?: string;
}

const config = {
  alert: {
    title: "down",
    color: "red",
  },
  degraded: {
    title: "degraded",
    color: "yellow",
  },
  recovery: {
    title: "up again",
    color: "green",
  },
};

export function renderMonitorAlertEmail(props: MonitorAlertEmailProps) {
  return renderTemplateWithFooter(
    `
<p><strong>Your monitor is <span style="color: ${config[props.type].color}">${
      config[props.type].title
    }</span></strong></p>
<ul>
  <li>Endpoint: ${props.url || "N/A"}</li>
  <li>Status: ${props.status || "N/A"}</li>
  <li>Latency: ${props.latency || "N/A"}</li>
  <li>Region: ${props.region || "N/A"}</li>
  <li>Timestamp: ${props.timestamp || "N/A"}</li>
  <li>Message: ${props.message || "N/A"}</li>
</ul>
<p>
    <a href="https://app.openstatus.dev">Go to dashboard</a>
</p>
    `,
    `Your monitor ${props.name} is ${config[props.type]}`,
  );
}
