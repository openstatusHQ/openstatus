import { db, eq } from "@openstatus/db";
import { page, selectWorkspaceSchema } from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";

import { createInnerTRPCContext } from "../trpc";
import { pageRouter } from "./page";

for (const allowed of [false, true]) {
  test(`custom domain feature ${allowed}: guards provider calls and permits clearing`, async () => {
    const fixture = await createTestWorkspace({
      plan: "free",
      limits: JSON.stringify({ "custom-domain": allowed }),
    });
    const workspace = selectWorkspaceSchema.parse(fixture.workspace);
    const existing = await createPage(workspace.id, {
      customDomain: "old.example.com",
    });
    const caller = pageRouter.createCaller(
      createInnerTRPCContext({
        session: { user: { id: String(fixture.user.id) } },
        user: fixture.user,
        workspace,
      }),
    );
    const requests: string[] = [];
    const fetch = globalThis.fetch;
    using _fetch = stub(globalThis, "fetch", (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin === "https://api.vercel.com") {
        requests.push(init?.method ?? "GET");
        return Promise.resolve(Response.json({}));
      }
      if (
        url.origin ===
        new URL(process.env.DATABASE_URL ?? "http://127.0.0.1:8080").origin
      ) {
        return fetch(input, init);
      }
      throw new Error(`Unexpected request to ${url.origin}`);
    });
    try {
      const update = caller.updateCustomDomain({
        id: existing.id,
        customDomain: "status.example.com",
      });
      if (allowed) {
        await update;
        expect(requests).toEqual(["POST", "DELETE"]);
      } else {
        await expect(update).rejects.toMatchObject({
          code: "TOO_MANY_REQUESTS",
        });
        expect(requests).toEqual([]);
      }
      const stored = await db
        .select()
        .from(page)
        .where(eq(page.id, existing.id))
        .get();
      expect(stored?.customDomain).toBe(
        allowed ? "status.example.com" : "old.example.com",
      );

      requests.length = 0;
      workspace.limits["custom-domain"] = false;
      await caller.updateCustomDomain({ id: existing.id, customDomain: "" });
      expect(requests).toEqual(["DELETE"]);
      const cleared = await db
        .select()
        .from(page)
        .where(eq(page.id, existing.id))
        .get();
      expect(cleared?.customDomain).toBe("");
    } finally {
      await db.delete(page).where(eq(page.id, existing.id));
      await clearAuditLogFor({ entityType: "page", entityIds: [existing.id] });
    }
  });
}
