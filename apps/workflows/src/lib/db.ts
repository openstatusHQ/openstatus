import { drizzle } from "drizzle-orm/libsql";

import { createClient } from "@libsql/client";
import { schema } from "@openstatus/db";
import { env } from "../env";

const file =
  env().NODE_ENV === "development" ? "dev.db" : "/app/data/replica.db";
const client = createClient({
  url: `file:${file}`,
  syncUrl: env().DATABASE_URL,
  authToken: env().DATABASE_AUTH_TOKEN,
  syncInterval: 60,
});

export const db = drizzle({
  client: client,
  schema,
});
