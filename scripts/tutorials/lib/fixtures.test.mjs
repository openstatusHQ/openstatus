import { describe, expect, test } from "vitest";

import { cleanup, pages, workspace } from "./fixtures.mjs";

describe("cleanup", () => {
  test("binds values as parameters, never into the SQL text", () => {
    const title = "x' or 1=1 --";
    for (const statement of [
      ...cleanup.statusReport({ title, pageId: pages.main }),
      ...cleanup.maintenance({ title, pageId: pages.main }),
      ...cleanup.notification({ name: title }),
      ...cleanup.monitor({ name: title }),
      ...cleanup.page({ slug: title }),
      ...cleanup.incident({ title }),
    ]) {
      expect(statement.q).not.toContain(title);
      expect(statement.params).toContain(title);
      // One ? per bound value, so sqld does not reject the statement.
      expect(statement.q.split("?").length - 1).toBe(statement.params.length);
    }
  });

  test("scopes rows by name to the seeded workspace", () => {
    for (const [statement] of [
      cleanup.monitor({ name: "npm Registry" }),
      cleanup.page({ slug: "acme-payments" }),
      cleanup.incident({ title: "Checkout API timeouts in eu-central" }),
    ]) {
      expect(statement.q).toContain("workspace_id = ?");
      expect(statement.params).toContain(workspace);
    }
  });

  test("deletes children before their parent row", () => {
    const tables = cleanup
      .statusReport({ title: "t", pageId: pages.main })
      .map((s) => s.q.match(/delete from (\w+)/)[1]);
    expect(tables.at(-1)).toBe("status_report");
    expect(tables.indexOf("status_report_update")).toBeLessThan(
      tables.indexOf("status_report"),
    );
  });
});
