import { getLogger } from "@logtape/logtape";
import { type Database, connect } from "@tursodatabase/sync";

import { env } from "../env";
import { reportBackgroundError } from "./sentry";

const logger = getLogger(["workflow", "replica"]);

const path =
  env().NODE_ENV === "development" ? "./dev.db" : "/app/data/replica-sync.db";

const FULL_BOOTSTRAP_QUERY = [
  "SELECT * FROM monitor",
  "SELECT * FROM maintenance",
  "SELECT * FROM page_component",
  "SELECT * FROM maintenance_to_page_component",
  "SELECT * FROM monitor_status",
].join("; ");

const FALLBACK_BOOTSTRAP_QUERY = "SELECT * FROM monitor";

const BACKGROUND_PULL_INTERVAL_MS = 60_000;

let dbPromise: Promise<Database> | null = null;
let pullIntervalHandle: ReturnType<typeof setInterval> | null = null;

async function bootstrap(query: string): Promise<Database> {
  return connect({
    path,
    url: env().DATABASE_URL,
    authToken: env().DATABASE_AUTH_TOKEN,
    clientName: "workflows-replica",
    partialSyncExperimental: {
      bootstrapStrategy: { kind: "query", query },
      prefetch: true,
    },
  });
}

export function getDb(): Promise<Database> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    let db: Database;
    try {
      db = await bootstrap(FULL_BOOTSTRAP_QUERY);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        "Full partial-sync bootstrap failed; degrading to single-table bootstrap",
        { error_message: message },
      );
      void reportBackgroundError(`partial-sync bootstrap degraded: ${message}`);
      db = await bootstrap(FALLBACK_BOOTSTRAP_QUERY);
    }

    pullIntervalHandle = setInterval(() => {
      void db.pull().catch((err: Error) => {
        logger.warn("Background replica pull failed", {
          error_message: err.message,
        });
      });
    }, BACKGROUND_PULL_INTERVAL_MS);

    return db;
  })();
  return dbPromise;
}

export async function shutdownDb(): Promise<void> {
  if (pullIntervalHandle) {
    clearInterval(pullIntervalHandle);
    pullIntervalHandle = null;
  }
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.close();
    } catch (err) {
      logger.warn("shutdownDb close failed", {
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
    dbPromise = null;
  }
}
