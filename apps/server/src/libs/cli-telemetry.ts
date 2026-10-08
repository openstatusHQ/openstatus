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
 * risk counting a run twice.
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
