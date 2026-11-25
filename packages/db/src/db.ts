import { createClient } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql/http";

import { env } from "../env.mjs";
import { withBusyRetryClient } from "./busy-retry";
import * as schema from "./schema";

const connection = {
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
};

// Suites run many test files in parallel against one sqld, so a statement that
// loses the write lock is refused at once with SQLITE_BUSY and fails the run.
// Production retries where the business meaning of a repeat is known instead.
export const db =
  process.env.NODE_ENV === "test"
    ? drizzle({
        client: withBusyRetryClient(createClient(connection)),
        schema,
      })
    : drizzle({ connection, schema });
