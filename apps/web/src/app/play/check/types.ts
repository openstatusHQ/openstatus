export type Timing = {
  dns: number;
  connection: number;
  tls: number;
  ttfb: number;
  transfer: number;
};

export type Headers = Record<string, string>;

// TBD: { timing: Timing }
export type RegionCheck = Timing & {
  name: string;
  status: number;
  headers: Headers;
};

export type Checker = {
  status: number;
  latency: number;
  headers: Headers;
  time: number;
  timing: {
    dnsStart: number;
    dnsDone: number;
    connectStart: number;
    connectDone: number;
    tlsHandshakeStart: number;
    tlsHandshakeDone: number;
    firstByteStart: number;
    firstByteDone: number;
    transferStart: number;
    transferDone: number;
  };
};
