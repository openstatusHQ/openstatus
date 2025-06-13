export const responseLogs = [
  {
    id: 1,
    url: "https://api.openstatus.dev",
    method: "GET",
    status: 200 as const,
    latency: 150,
    timing: {
      dns: 10,
      connect: 20,
      tls: 30,
      ttfb: 40,
      transfer: 50,
    },
    assertions: [],
    region: "ams" as const,
    error: false,
    timestamp: new Date().getTime(),
    headers: {
      "Cache-Control":
        "private, no-cache, no-store, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
      Date: "Sun, 28 Jan 2024 08:50:13 GMT",
      Server: "Vercel",
    },
    type: "scheduled" as const satisfies "scheduled" | "on-demand",
  },
  {
    id: 2,
    url: "https://api.openstatus.dev",
    method: "GET",
    status: 500 as const,
    latency: 150,
    timing: {
      dns: 4,
      connect: 120,
      tls: 12,
      ttfb: 20,
      transfer: 40,
    },
    assertions: [],
    region: "ams" as const,
    error: true,
    timestamp: new Date().getTime(),
    headers: {
      "Cache-Control":
        "private, no-cache, no-store, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
      Date: "Sun, 28 Jan 2024 08:50:13 GMT",
      Server: "Vercel",
    },
    type: "scheduled" as const satisfies "scheduled" | "on-demand",
    // error message
    message:
      "Environment variable 'NEXT_PUBLIC_TEST_KEY' is missing. Please add and redeploy your project.",
  },
];

export type ResponseLog = (typeof responseLogs)[number];
export type Timing = ResponseLog["timing"];
