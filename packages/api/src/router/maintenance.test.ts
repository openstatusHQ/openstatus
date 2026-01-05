import { expect, test } from "bun:test";
import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

function getTestContext() {
  return createInnerTRPCContext({
    req: undefined,
    session: {
      user: {
        // @ts-expect-error
        id: 1,
      },
    },
  });
}

const from = new Date();
const to = new Date(from.getTime() + 1000 * 60 * 60);

test("Create Maintenance", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMaintenance = await caller.maintenance.new({
    title: "Test Maintenance",
    message: "This is a test maintenance.",
    startDate:from,
    endDate:to,
    pageId:1,
  });

  expect(createdMaintenance).toMatchObject({
    id: expect.any(Number),
    title: "Test Maintenance",
    message: "This is a test maintenance.",
    from,
    to,
    workspaceId: 1,
  });
});

test("Get Maintenance by ID", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMaintenance = await caller.maintenance.new({
    title: "Test Maintenance",
    message: "This is a test maintenance.",
    startDate:from,
    endDate:to,
    pageId:1,
  });

  const createdMaintenanceId = createdMaintenance.id;

  const fetchedMaintenance = await caller.maintenance.getById({
    id: createdMaintenanceId,
  });

  expect(fetchedMaintenance).toMatchObject({
    id: createdMaintenance.id,
    title: "Test Maintenance",
    message: "This is a test maintenance.",
    from,
    to,
    workspaceId: 1,
  });
});

test("Update Maintenance", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMaintenance = await caller.maintenance.new({
    title: "Test Maintenance",
    message: "This is a test maintenance.",
    startDate:from,
    endDate:to,
    pageId:1,
  });

  const createdMaintenanceId = createdMaintenance.id;

    await caller.maintenance.update({
    id: createdMaintenanceId,
    title: "Updated Test Maintenance",
    message: "This is an updated test maintenance.",
    startDate: from,
    endDate:to,
  });

    const updatedMaintenance = await caller.maintenance.getById({
      id: createdMaintenanceId,
    });

  expect(updatedMaintenance).toMatchObject({
    id: createdMaintenanceId,
    title: "Updated Test Maintenance",
    message: "This is an updated test maintenance.",
    from,
    to,
    workspaceId: 1,
  });
});

test("Delete Maintenance", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMaintenance = await caller.maintenance.new({
    title: "Test Maintenance",
    message: "This is a test maintenance.",
    startDate:from,
    endDate:to,
    pageId:1,
  });

  const createdMaintenanceId = createdMaintenance.id;

  const deletedMaintenance = await caller.maintenance.delete({
    id: createdMaintenanceId,
  });

  expect(deletedMaintenance).toBeDefined();
});
