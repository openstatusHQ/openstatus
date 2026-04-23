import { db, eq } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { bot, slackAdapter } from "./bot";

interface SlackCredential {
  botToken: string;
  botUserId: string;
}

interface SlackData {
  teamName?: string;
}

export async function migrateExistingInstallations() {
  await bot.initialize();

  const rows = await db
    .select({
      externalId: integration.externalId,
      credential: integration.credential,
      data: integration.data,
    })
    .from(integration)
    .where(eq(integration.name, "slack-agent"))
    .all();

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    const credential = row.credential as SlackCredential | null;
    const data = row.data as SlackData | null;

    if (!credential?.botToken) {
      console.warn(`Skipping team ${row.externalId}: no botToken in credential`);
      failed++;
      continue;
    }

    try {
      await slackAdapter.setInstallation(row.externalId, {
        botToken: credential.botToken,
        botUserId: credential.botUserId ?? "",
        teamName: data?.teamName ?? "",
      });
      console.log(`Migrated team ${row.externalId}`);
      success++;
    } catch (err) {
      console.error(`Failed to migrate team ${row.externalId}:`, err);
      failed++;
    }
  }

  console.log(`Migration complete: ${success} succeeded, ${failed} failed, ${rows.length} total`);
}
