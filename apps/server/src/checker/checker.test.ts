import { expect, mock, test } from "bun:test";

import { checkerRetryPolicy } from "./checker";

mock.module("./ping.ts", () => {
  return {
    publishPing: () => {},
  };
});

test("should call updateMonitorStatus when we can fetch", async () => {
  const fn = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
    };
  });
  await checkerRetryPolicy({
    workspaceId: "1",
    monitorId: "1",
    url: "https://www.google.com",
    cronTimestamp: 1,
    status: "error",
    pageIds: [],
    method: "GET",
  });
  expect(fn).toHaveBeenCalledTimes(1);
});

test("should call updateMonitorStatus when status error", async () => {
  const fn = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
    };
  });
  try {
    await checkerRetryPolicy({
      workspaceId: "1",
      monitorId: "1",
      url: "https://xxxxxxx.fake",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(fn).toHaveBeenCalledTimes(1);
});

test("What should we do when redirect ", async () => {
  const fn = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
    };
  });
  try {
    await checkerRetryPolicy({
      workspaceId: "1",
      monitorId: "1",
      url: "https://www.openstatus.dev/toto",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(fn).toHaveBeenCalledTimes(0);
});

test("When 404 we should trigger alerting ", async () => {
  const fn = mock(() => {});
  const fn1 = mock(() => {});
  const fn2 = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
      triggerAlerting: fn1,
    };
  });
  mock.module("./ping.ts", () => {
    return {
      publishPing: fn2,
    };
  });
  try {
    await checkerRetryPolicy({
      workspaceId: "1",
      monitorId: "1",
      url: "https://www.openstat.us/404",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn1).toHaveBeenCalledTimes(1);
  expect(fn2).toHaveBeenCalledTimes(1);
});

test("When error  404 we should not trigger alerting ", async () => {
  const fn = mock(() => {});
  const fn1 = mock(() => {});
  const fn2 = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
      triggerAlerting: fn1,
    };
  });

  mock.module("./ping.ts", () => {
    return {
      publishPing: fn2,
    };
  });
  try {
    await checkerRetryPolicy({
      workspaceId: "1",
      monitorId: "1",
      url: "https://www.openstat.us/404",
      cronTimestamp: 1,
      status: "error",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(fn).toHaveBeenCalledTimes(0);
  expect(fn1).toHaveBeenCalledTimes(0);
  expect(fn2).toHaveBeenCalledTimes(1);
});
