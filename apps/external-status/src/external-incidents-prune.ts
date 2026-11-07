import { getLogger } from "@logtape/logtape";
import { db } from "@openstatus/db";
import { pruneStaleRawPayloads } from "@openstatus/services/external-service-incident";

const logger = getLogger(["external-status", "incidents-prune"]);

export async function runExternalIncidentsPruneTick(): Promise<{
  purged: number;
}> {
  return pruneStaleRawPayloads({ ctx: { db } });
}

export async function runExternalIncidentsPruneCron(): Promise<void> {
  const res = await runExternalIncidentsPruneTick();
  logger.info("external-incidents-prune tick complete: purged={purged}", {
    purged: res.purged,
  });
}
