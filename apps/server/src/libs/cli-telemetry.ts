import { getLogger } from "@logtape/logtape";
import { type EventProps, Events } from "@openstatus/analytics";

import { cacheKeys } from "@/libs/cache-keys";
import { redis } from "@/libs/clients";

const logger = getLogger("api-server");

export const CLI_COMMAND_HEADER = "x-openstatus-cli-command";
export const CLI_INVOCATION_HEADER = "x-openstatus-cli-invocation";

// `openstatus-cli/v1.3.2 (darwin; arm64)`
const USER_AGENT_RE =
  /^openstatus-cli\/v?([\w.+-]{1,32}) \(([^;)]{1,32}); ([^)]{1,32})\)/;
// Full command path with aliases resolved, e.g. `private-locations list`.
const COMMAND_RE = /^[a-z0-9-]+( [a-z0-9-]+){0,4}$/;
// A random per-run id; it becomes part of a Redis key, so keep it tight.
const INVOCATION_RE = /^[A-Za-z0-9-]{8,64}$/;

// A CLI run is a handful of sequential requests; an hour covers it with room.
const INVOCATION_TTL_SECONDS = 60 * 60;

export type CliInfo = {
  command: string;
  invocation: string;
  version?: string;
  os?: string;
  arch?: string;
};

/**
 * The telemetry the openstatus CLI attaches to every request, or `undefined`
 * when the request did not come from the CLI (or carries values we won't
 * store). Header values are client-controlled, hence the strict patterns.
 */
export function parseCliHeaders(headers: Headers): CliInfo | undefined {
  const command = headers.get(CLI_COMMAND_HEADER);
  const invocation = headers.get(CLI_INVOCATION_HEADER);
  if (!command || command.length > 100 || !COMMAND_RE.test(command)) return;
  if (!invocation || !INVOCATION_RE.test(invocation)) return;

  const ua = USER_AGENT_RE.exec(headers.get("user-agent") ?? "");
  return {
    command,
    invocation,
    ...(ua ? { version: ua[1], os: ua[2], arch: ua[3] } : {}),
  };
}

/**
 * The `cli_command` event for this run, or `undefined` if another request of
 * the same run already claimed it. One CLI command can make several requests
 * (possibly to different machines); the Redis `NX` claim makes the first one
 * win so each run counts once. A Redis failure drops the event rather than
 * risk counting a run twice. Prefer `trackCliCommand`, which also gives the
 * claim back when the send fails.
 */
export async function claimCliCommandEvent(
  workspaceId: number,
  cli: CliInfo,
): Promise<(EventProps & Record<string, unknown>) | undefined> {
  try {
    const claimed = await redis.set(
      cacheKeys.cliInvocation(workspaceId, cli.invocation),
      "1",
      { nx: true, ex: INVOCATION_TTL_SECONDS },
    );
    if (!claimed) return;
  } catch {
    logger.warn("Failed to claim CLI invocation for workspace {workspaceId}", {
      workspaceId,
    });
    return;
  }

  return {
    ...Events.CliCommand,
    command: cli.command,
    invocation: cli.invocation,
    ...(cli.version ? { version: cli.version } : {}),
    ...(cli.os ? { os: cli.os } : {}),
    ...(cli.arch ? { arch: cli.arch } : {}),
  };
}

type Analytics = {
  track: (event: EventProps & Record<string, unknown>) => Promise<unknown>;
};

/**
 * Sends this run's `cli_command` through `analytics` if this request is the
 * first of the run to claim it. Claim only once analytics is set up, and give
 * the claim back if the send rejects, so a later request of the same run can
 * still count it instead of the run being lost for the claim's TTL.
 */
export async function trackCliCommand(
  analytics: Analytics,
  workspaceId: number,
  cli: CliInfo,
): Promise<void> {
  const event = await claimCliCommandEvent(workspaceId, cli);
  if (!event) return;
  try {
    await analytics.track(event);
  } catch (error) {
    await redis
      .del(cacheKeys.cliInvocation(workspaceId, cli.invocation))
      .catch(() => {});
    throw error;
  }
}
