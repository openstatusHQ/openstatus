import { db as defaultDb, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import type { DB } from "../context";

/** The raw monitor row by id, in any workspace; for ingest paths that hold only the id. */
export async function findMonitor(args: { id: number; db?: DB }) {
  return (args.db ?? defaultDb)
    .select()
    .from(monitor)
    .where(eq(monitor.id, args.id))
    .get();
}
