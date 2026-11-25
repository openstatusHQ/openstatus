import { getLogger } from "@logtape/logtape";
import { pruneStaleRawPayloads } from "@openstatus/services/external-service-incident";

const logger = getLogger(["external-status", "incidents-prune"]);

export async function runExternalIncidentsPruneTick(): Promise<{
  purged: number;
}> {
  return pruneStaleRawPayloads({});
}

export async function runExternalIncidentsPruneCron(): Promise<void> {
  const res = await runExternalIncidentsPruneTick();
  logger.info("external-incidents-prune tick complete: purged={purged}", {
    purged: res.purged,
  });
}
