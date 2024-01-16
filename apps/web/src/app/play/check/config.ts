import type { Headers, RegionCheck, Timing } from "./types";

export const timingDict = {
  dns: {
    short: "DNS",
    long: "DNS Lookup",
    description:
      "Time spent performing the DNS lookup. DNS lookup resolves domain names to IP addresses. Every new domain requires a full round trip to do the DNS lookup. There is no DNS lookup when the destination is already an IP address.",
  },
  connection: {
    short: "TCP",
    long: "Initial Connection",
    description:
      "Time it took to establish TCP connection between a source host and destination host. Connections must be properly established in a multi-step handshake process. TCP connection is managed by an operating system, if the underlying TCP connection cannot be established, the OS-wide TCP connection timeout will overrule the timeout config of our application.",
  },
  tls: {
    short: "TLS",
    long: "TLS Handshake",
    description:
      "Time spent completing a TLS handshake. During the handshake process endpoints exchange authentication and keys to establish or resume secure sessions. There is no TLS handshake with a not HTTPS request.",
  },
  ttfb: {
    short: "TTFB",
    long: "Time to First Byte",
    description:
      "Time spent waiting for the initial response. This time captures the latency of a round trip to the server in addition to the time spent waiting for the server to process the request and deliver the response.",
  },
  transfer: {
    short: "Transfer",
    long: "Content Transfer",
    description:
      "Time spent receiving the response data. The size of the response data and the available network bandwidth determinates its duration.",
  },
} as const;

export const timingExample: Timing = {
  dns: 120,
  connection: 1,
  tls: 6,
  ttfb: 1_566,
  transfer: 2,
};

export const headersExample: Headers = {
  Age: "6",
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Content-Type": "text/html; charset=utf-8",
  Date: "Mon, 15 Jan 2024 19:08:55 GMT",
  "Referrer-Policy": "origin-when-cross-origin",
  "Set-Cookie":
    "mkting_exp=77562; Path=/; Expires=Mon, 23 Sep 2024 19:09:01 GMT",
  "X-Vercel-Cache": "HIT",
};

export const example: RegionCheck[] = [
  {
    name: "America",
    status: 200,
    dns: 120,
    connection: 1,
    tls: 6,
    ttfb: 1_566,
    transfer: 2,
    headers: headersExample,
  },
  {
    name: "Asia",
    status: 200,
    dns: 100,
    connection: 4,
    tls: 8,
    ttfb: 1_103,
    transfer: 4,
    headers: headersExample,
  },
  {
    name: "Europe",
    status: 200,
    dns: 56,
    connection: 4,
    tls: 3,
    ttfb: 900,
    transfer: 4,
    headers: headersExample,
  },
  {
    name: "Australia",
    status: 200,
    dns: 100,
    connection: 4,
    tls: 3,
    ttfb: 1_900,
    transfer: 10,
    headers: headersExample,
  },
  {
    name: "South America",
    status: 200,
    dns: 56,
    connection: 4,
    tls: 3,
    ttfb: 1_100,
    transfer: 4,
    headers: headersExample,
  },
  {
    name: "South America",
    status: 200,
    dns: 100,
    connection: 4,
    tls: 3,
    ttfb: 1_500,
    transfer: 4,
    headers: headersExample,
  },
];
