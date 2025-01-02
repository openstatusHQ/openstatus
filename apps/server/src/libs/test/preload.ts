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
    httpStatus45d() {
      return Promise.resolve({ data: [] });
    }
    tcpStatus45d() {
      return Promise.resolve({ data: [] });
    }
  },
}));
