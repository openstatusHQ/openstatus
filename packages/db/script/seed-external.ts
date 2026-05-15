import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "../env.mjs";
import { externalService } from "../src/schema";
import { externalServicesSeed } from "../src/seed/external-services";

async function main() {
  const db = drizzle(createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }));
  console.log("Seeding database ");

  await db.insert(externalService).values(externalServicesSeed).onConflictDoNothing().run();

  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed");
  console.error(e);
  process.exit(1);
});
