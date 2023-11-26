import { expect, mock, test } from "bun:test";

import { checkerRetryPolicy } from "./checker";

mock.module("./ping.ts", () => {
  return {
    publishPing: () => {},
  };
});

test("should call upsertMonitorStatus when we can fetch", async () => {
  const fn = mock(() => {});

  mock.module("./monitor-handler.ts", () => {
    return {
      handleMonitorFailed: mock(() => {}),
      handleMonitorRecovered: fn,
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

test("should call upsertMonitorStatus when status error", async () => {
  const fn = mock(() => {});

  mock.module("./monitor-handler.ts", () => {
    return {
      handleMonitorFailed: fn,
      handleMonitorRecovered: mock(() => {}),
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

  mock.module("./monitor-handler.ts", () => {
    return {
      handleMonitorFailed: fn,
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

  mock.module("./ping.ts", () => {
    return {
      publishPing: fn,
    };
  });
  mock.module("./monitor-handler.ts", () => {
    return {
      handleMonitorFailed: fn1,
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
});

test("When error  404 we should not trigger alerting ", async () => {
  const fn = mock(() => {});
  const fn1 = mock(() => {});

  mock.module("./ping.ts", () => {
    return {
      publishPing: fn,
    };
  });
  mock.module("./monitor-handler.ts", () => {
    return {
      handleMonitorFailed: fn1,
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
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn1).toHaveBeenCalledTimes(0);
});
