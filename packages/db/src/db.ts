import { createClient } from "@libsql/client/web";

import { drizzle } from "drizzle-orm/libsql";
import { env } from "../env.mjs";
import * as schema from "./schema";

const client = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
