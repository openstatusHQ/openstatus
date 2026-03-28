import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const REPLICA_DIR = join(homedir(), ".openstatus");
const REPLICA_PATH = join(REPLICA_DIR, "replica.db");

async function main() {
  const prodUrl = process.env.DATABASE_URL;
  const prodToken = process.env.DATABASE_AUTH_TOKEN;

  if (!prodUrl || !prodToken) {
    console.error(
      "DATABASE_URL and DATABASE_AUTH_TOKEN must be set in environment",
    );
    process.exit(1);
  }

  // Ensure directory exists
  if (!existsSync(REPLICA_DIR)) {
    mkdirSync(REPLICA_DIR, { recursive: true });
  }

  // Remove previous replica entirely to avoid stale WAL/lock issues
  for (const suffix of ["", "-shm", "-wal", "-client_wal_index"]) {
    const file = `${REPLICA_PATH}${suffix}`;
    if (existsSync(file)) unlinkSync(file);
  }

  console.log(`Syncing ${prodUrl} → ${REPLICA_PATH}`);

  const client = createClient({
    url: `file:${REPLICA_PATH}`,
    syncUrl: prodUrl,
    authToken: prodToken,
  });

  await client.sync();
  client.close();
  console.log("Sync complete");

  // Reopen as a purely local DB (no syncUrl) to scrub sensitive data.
  // This ensures DELETEs are local-only and never forwarded to prod.
  console.log("Scrubbing sensitive data...");
  const localClient = createClient({ url: `file:${REPLICA_PATH}` });
  await localClient.execute("DELETE FROM api_key");
  await localClient.execute("DELETE FROM session");
  localClient.close();
  console.log("Scrubbed api_key and session tables");

  console.log("Done! Register MCP with:");
  console.log(`  claude mcp add turso -- tursodb ${REPLICA_PATH} --mcp`);

  process.exit(0);
}

main().catch((e) => {
  console.error("Sync failed");
  console.error(e);
  process.exit(1);
});
