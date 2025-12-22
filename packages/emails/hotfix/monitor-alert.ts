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

export function monitorAlertEmail(props: MonitorAlertEmailProps) {
  return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <body>
    <p>Your monitor is ${props.type}</p>
    <ul>
      <li>URL: ${props.url || "N/A"}</li>
      <li>Status: ${props.status || "N/A"}</li>
      <li>Timestamp: ${props.timestamp || "N/A"}</li>
      <li>Message: ${props.message || "N/A"}</li>
    </ul>
  </body>
</html>
`;
}
