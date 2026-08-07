import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";

const headers = {
  "x-openstatus-key": "1",
  "content-type": "application/json",
};

test("maintenance update REST CRUD", async () => {
  const created = await app.request("/v1/maintenanceUpdates", {
    method: "POST",
    headers,
    body: JSON.stringify({
      maintenanceId: 1,
      message: "REST maintenance update",
      notify: false,
    }),
  });
  expect(created.status).toBe(200);
  const update = await created.json();

  const fetched = await app.request(`/v1/maintenanceUpdates/${update.id}`, {
    headers,
  });
  expect(fetched.status).toBe(200);

  const edited = await app.request(`/v1/maintenanceUpdates/${update.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: "Edited REST maintenance update" }),
  });
  expect(edited.status).toBe(200);
  expect((await edited.json()).message).toBe("Edited REST maintenance update");

  const deleted = await app.request(`/v1/maintenanceUpdates/${update.id}`, {
    method: "DELETE",
    headers,
  });
  expect(deleted.status).toBe(200);
  expect(await deleted.json()).toEqual({ success: true });
});

test("maintenance update REST requires authentication", async () => {
  const response = await app.request("/v1/maintenanceUpdates/1");
  expect(response.status).toBe(401);
});
