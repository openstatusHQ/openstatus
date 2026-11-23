import { db as defaultDb, eq } from "@openstatus/db";
import { viewer } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { TouchViewerInput } from "./schemas";

/**
 * Stamp a status-page viewer's last sign-in.
 *
 * No `ServiceContext` and no audit row: a viewer is an anonymous visitor of a
 * gated page, outside any workspace.
 */
export async function touchViewer(args: {
  input: TouchViewerInput;
  db?: DB;
}): Promise<void> {
  const input = TouchViewerInput.parse(args.input);
  await (args.db ?? defaultDb)
    .update(viewer)
    .set({ updatedAt: new Date() })
    .where(eq(viewer.id, input.id))
    .run();
}
