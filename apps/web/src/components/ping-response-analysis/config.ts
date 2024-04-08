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
