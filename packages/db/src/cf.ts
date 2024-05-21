import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export const createDb = ({ client }: { client: Client }) => {
  return drizzle(client, { schema });
};
