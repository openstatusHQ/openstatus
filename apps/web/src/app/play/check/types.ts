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
