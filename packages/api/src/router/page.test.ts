import { expect, test } from "bun:test";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

test("Get Test Page", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error
    auth: {
      userId: "1",
      sessionId: "1",
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.page.getPageBySlug({ slug: "status" });
  expect(result).toMatchObject({
    createdAt: expect.any(Date),
    customDomain: "",
    description: "hello",
    icon: "https://www.openstatus.dev/favicon.ico",
    statusReports: [
      {
        id: 1,
        status: "monitoring",
        title: "Test Status Report",
        workspaceId: 1,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
      {
        id: 2,
        status: "investigating",
        title: "Test Status Report",
        workspaceId: 1,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        monitorsToStatusReports: [
          {
            monitorId: 1,
            statusReportId: 2,
            monitor: {
              id: 1,
              jobType: "other",
              periodicity: "1m",
              status: "active",
              active: true,
              regions: ["ams"],
              url: "https://www.openstatus.dev",
              name: "OpenStatus",
              description: "OpenStatus website",
              workspaceId: 1,
              assertions: null,
              public: false,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              deletedAt: null,
            },
          },
          {
            monitorId: 2,
            statusReportId: 2,
            monitor: {
              id: 2,
              jobType: "other",
              periodicity: "10m",
              status: "active",
              active: false,
              regions: ["gru"],
              url: "https://www.google.com",
              name: "",
              description: "",
              workspaceId: 1,
              assertions: null,
              public: true,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              deletedAt: null,
            },
          },
        ],
      },
    ],
    monitors: [
      {
        active: true,
        createdAt: expect.any(Date),
        description: "OpenStatus website",
        id: 1,
        jobType: "other",
        name: "OpenStatus",
        periodicity: "1m",
        status: "active",
        updatedAt: expect.any(Date),
        url: "https://www.openstatus.dev",
        workspaceId: 1,
      },
    ],
    published: true,
    slug: "status",
    title: "Test Page",
    updatedAt: expect.any(Date),
  });
});

test("No Page", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error
    auth: {
      userId: "1",
      sessionId: "1",
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.page.getPageBySlug({ slug: "Dont Exist" });
  expect(result).toBeUndefined();
});
