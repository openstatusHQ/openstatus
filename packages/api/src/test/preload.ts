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
