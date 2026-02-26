import { mock } from "bun:test";

void mock.module("@openstatus/upstash", () => ({
  Redis: {
    fromEnv() {
      return {
        get: () => Promise.resolve(undefined),
        set: () => Promise.resolve([]),
      };
    },
  },
}));
