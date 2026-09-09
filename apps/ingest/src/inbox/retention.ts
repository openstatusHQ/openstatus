import { getLogger } from "@logtape/logtape";
import {
  pruneAlertInbox,
  type PruneResult,
} from "@openstatus/services/alert-inbox";

const logger = getLogger(["ingest"]);

export async function pruneOnce(): Promise<PruneResult> {
  const result = await pruneAlertInbox({});
  if (result.processed + result.ignored + result.deadLettered > 0) {
    logger.info("inbox pruned", { ...result });
  }
  return result;
}
