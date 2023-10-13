import { expect, mock, spyOn, test } from "bun:test";

import { updateMonitorStatus } from "./alerting";
import { checker, monitor } from "./checker";

test("Checker", async () => {
  const mockedUpdate = mock(updateMonitorStatus);
  const mockMonitor = mock(monitor);
  const result = await checker({
    workspaceId: "1",
    monitorId: "1",
    url: "https://google.com",
    cronTimestamp: 1,
    status: "active",
    pageIds: [],
    method: "GET",
  });
  expect(mockedUpdate).toHaveBeenCalled();
  expect(mockMonitor).toHaveBeenCalled();
});
