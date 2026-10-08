import { db, eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";

const headers = {
  "x-openstatus-key": "1",
  "content-type": "application/json",
};

test("maintenance update REST CRUD", async () => {
  const from = new Date(Date.now() + 60 * 60 * 1000);
  const to = new Date(from.getTime() + 60 * 60 * 1000);
  const parentRes = await app.request("/v1/maintenance", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "REST update parent",
      message: "announcement",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
    }),
  });
  expect(parentRes.status).toBe(200);
  const parent = await parentRes.json();

  try {
    const created = await app.request("/v1/maintenance_update", {
      method: "POST",
      headers,
      body: JSON.stringify({
        maintenanceId: parent.id,
        message: "REST maintenance update",
        notify: false,
      }),
    });
    expect(created.status).toBe(200);
    const update = await created.json();

    const fetched = await app.request(`/v1/maintenance_update/${update.id}`, {
      headers,
    });
    expect(fetched.status).toBe(200);
    const fetchedBody = await fetched.json();
    expect(fetchedBody.id).toBe(update.id);
    expect(fetchedBody.message).toBe("REST maintenance update");

    const edited = await app.request(`/v1/maintenance_update/${update.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: "Edited REST maintenance update" }),
    });
    expect(edited.status).toBe(200);
    expect((await edited.json()).message).toBe(
      "Edited REST maintenance update",
    );

    // `message` is the newest update
    const parentAgain = await app.request(`/v1/maintenance/${parent.id}`, {
      headers,
    });
    expect((await parentAgain.json()).message).toBe(
      "Edited REST maintenance update",
    );

    const deleted = await app.request(`/v1/maintenance_update/${update.id}`, {
      method: "DELETE",
      headers,
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true });
  } finally {
    await db.delete(maintenance).where(eq(maintenance.id, parent.id));
  }
});

test("maintenance update REST requires authentication", async () => {
  const response = await app.request("/v1/maintenance_update/1");
  expect(response.status).toBe(401);
});
