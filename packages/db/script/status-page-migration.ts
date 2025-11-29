import { db, eq, schema } from "../src";

await db
  .update(schema.page)
  .set({
    legacyPage: false,
    configuration: JSON.stringify({
      uptime: true,
      value: "duration",
      type: "absolute",
      theme: "default-rounded",
    }),
  })
  .where(eq(schema.page.legacyPage, true))
  .execute();
