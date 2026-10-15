import { Events } from "@openstatus/analytics";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  claimCliCommandEvent,
  parseCliHeaders,
  trackCliCommand,
} from "./cli-telemetry";

function cliHeaders(overrides: Record<string, string> = {}) {
  return new Headers({
    "user-agent": "openstatus-cli/v1.3.2 (darwin; arm64)",
    "x-openstatus-cli-command": "private-locations list",
    "x-openstatus-cli-invocation": crypto.randomUUID(),
    ...overrides,
  });
}

describe("parseCliHeaders", () => {
  test("reads command, invocation and the user-agent version/platform", () => {
    const headers = cliHeaders({ "x-openstatus-cli-invocation": "2452a64f" });

    expect(parseCliHeaders(headers)).toEqual({
      command: "private-locations list",
      invocation: "2452a64f",
      version: "1.3.2",
      os: "darwin",
      arch: "arm64",
    });
  });

  test("returns undefined for requests not sent by the CLI", () => {
    expect(parseCliHeaders(new Headers({ "user-agent": "curl/8" }))).toBe(
      undefined,
    );
  });

  test("rejects malformed command and invocation values", () => {
    expect(
      parseCliHeaders(cliHeaders({ "x-openstatus-cli-command": "rm -rf /" })),
    ).toBe(undefined);
    expect(
      parseCliHeaders(
        cliHeaders({ "x-openstatus-cli-invocation": "a:b:c:d:e" }),
      ),
    ).toBe(undefined);
  });

  test("keeps the command when the user agent is not the CLI's", () => {
    const cli = parseCliHeaders(cliHeaders({ "user-agent": "custom" }));

    expect(cli?.command).toBe("private-locations list");
    expect(cli?.version).toBe(undefined);
  });
});

describe("claimCliCommandEvent", () => {
  test("returns the event once per invocation and workspace", async () => {
    const cli = parseCliHeaders(cliHeaders());
    if (!cli) throw new Error("expected CLI headers to parse");

    expect(await claimCliCommandEvent(1, cli)).toEqual({
      ...Events.CliCommand,
      command: "private-locations list",
      invocation: cli.invocation,
      version: "1.3.2",
      os: "darwin",
      arch: "arm64",
    });
    expect(await claimCliCommandEvent(1, cli)).toBe(undefined);
    // Keyed per workspace: another workspace can't swallow this run.
    expect(await claimCliCommandEvent(2, cli)).not.toBe(undefined);
  });
});

describe("trackCliCommand", () => {
  test("releases the claim when the send fails so a later request retries", async () => {
    const cli = parseCliHeaders(cliHeaders());
    if (!cli) throw new Error("expected CLI headers to parse");
    const sent: unknown[] = [];
    const failing = { track: () => Promise.reject(new Error("down")) };
    const working = {
      track: (event: unknown) => {
        sent.push(event);
        return Promise.resolve();
      },
    };

    await expect(trackCliCommand(failing, 1, cli)).rejects.toThrow("down");
    await trackCliCommand(working, 1, cli);
    await trackCliCommand(working, 1, cli);

    expect(sent).toHaveLength(1);
  });
});
