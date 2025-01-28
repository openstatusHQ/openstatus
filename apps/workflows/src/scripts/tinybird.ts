import { db, eq } from "@openstatus/db";
import { type WorkspacePlan, workspace } from "@openstatus/db/src/schema";
import { env } from "../env";

import readline from "node:readline";

// Function to prompt user for confirmation
const askConfirmation = async (question: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
};

/**
 * Calculates the unix timestamp in milliseconds for a given number of days in the past.
 * @param days The number of days to subtract from the current date.
 * @returns The calculated unix timestamp in milliseconds.
 */
function calculatePastTimestamp(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const timestamp = date.getTime();
  console.log(`${days}d back: ${timestamp}`);
  return timestamp;
}

/**
 * Get the array of workspace IDs for a given plan.
 * @param plan The plan to filter by.
 * @returns The array of workspace IDs.
 */
async function getWorkspaceIdsByPlan(plan: WorkspacePlan) {
  const workspaces = await db
    .select()
    .from(workspace)
    .where(eq(workspace.plan, plan))
    .all();
  const workspaceIds = workspaces.map((w) => w.id);
  console.log(`${plan}: ${workspaceIds}`);
  return workspaceIds;
}

/**
 *
 * @param timestamp  timestamp to delete logs before (in milliseconds)
 * @param workspaceIds array of workspace IDs to delete logs for
 * @param reverse allows to NOT delete the logs for the given workspace IDs
 * @returns
 */
async function deleteLogs(
  timestamp: number,
  workspaceIds: number[],
  reverse = false,
) {
  const response = await fetch(
    "https://api.tinybird.co/v0/datasources/ping_response__v8/delete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${env().TINY_BIRD_API_KEY}`,
      },
      body: new URLSearchParams({
        delete_condition: `timestamp <= ${timestamp} AND ${reverse ? "NOT" : ""} arrayExists(x -> x IN (${workspaceIds.join(", ")}), [workspaceId])`,
      }),
    },
  );
  const json = await response.json();
  console.log(json);

  return json;
}

async function main() {
  // check if the script is running in production
  console.log(`DATABASE_URL: ${env().DATABASE_URL}`);

  const isConfirmed = await askConfirmation(
    "Are you sure you want to run this script?",
  );

  if (!isConfirmed) {
    console.log("Script execution cancelled.");
    return;
  }

  const lastTwoWeeks = calculatePastTimestamp(14);
  const lastThreeMonths = calculatePastTimestamp(90);
  const lastYear = calculatePastTimestamp(365);
  // const _lastTwoYears = calculatePastTimestamp(730);

  const starters = await getWorkspaceIdsByPlan("starter");
  const teams = await getWorkspaceIdsByPlan("team");
  const pros = await getWorkspaceIdsByPlan("pro");

  // all other workspaces, we need to 'reverse' the deletion here to NOT include those workspaces
  const rest = [...starters, ...teams, ...pros];

  deleteLogs(lastTwoWeeks, rest, true);
  deleteLogs(lastThreeMonths, starters);
  deleteLogs(lastYear, teams);
  deleteLogs(lastYear, pros);
}

/**
 * REMINDER: do it manually (to avoid accidental deletion on dev mode)
 * Within the app/workflows folder, run the following command:
 * $ bun src/scripts/tinybird.ts
 */

// main().catch(console.error);
