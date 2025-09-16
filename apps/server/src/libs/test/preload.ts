import { mock } from "bun:test";

mock.module("@openstatus/upstash", () => ({
  Redis: {
    fromEnv() {
      return {
        get: () => Promise.resolve(undefined),
        set: () => Promise.resolve([]),
      };
    },
  },
}));

mock.module("@openstatus/tinybird", () => ({
  OSTinybird: class {
    get legacy_httpStatus45d() {
      return () => Promise.resolve({ data: [] });
    }
    get legacy_tcpStatus45d() {
      return () => Promise.resolve({ data: [] });
    }
  },
}));
