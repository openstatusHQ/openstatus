import { drizzle } from "drizzle-orm/libsql";

import { env } from "../env.mjs";
import * as schema from "./schema";
import { createClient } from "@libsql/client";

const client = createClient({
  url: "file:/app/data/local.db",
  syncUrl: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
  syncInterval: 60,
});


export const syncDB = drizzle({
  client: client,
  schema,
});
