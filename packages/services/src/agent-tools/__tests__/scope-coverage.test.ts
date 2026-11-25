import type { Scope } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeMcpCtx,
  withTestTransaction,
  type WorkspaceFixture,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import { agentToolList } from "../index";

// A tool's declared scope decides which keys see it; the verbs it calls
// decide what actually runs. Each tool runs once with no scope (its verb
// must refuse) and once with exactly its declared scope (no verb may refuse
// for scope). Empty input: verbs check scope before parsing.

const SCOPE_ERROR = /lacks required scope/;

let team: WorkspaceFixture;

beforeAll(async () => {
  team = await createWorkspaceFixture("team");
});

async function scopeError(
  tool: (typeof agentToolList)[number],
  scopes: Scope[],
): Promise<string | null> {
  return withTestTransaction(async (tx) => {
    const ctx = {
      ...makeMcpCtx(team.workspace, {
        keyId: "scope-coverage",
        userId: team.userId,
        scopes,
      }),
      db: tx,
    };
    try {
      await tool.run({ ctx, input: {} });
      return null;
    } catch (err) {
      if (err instanceof ForbiddenError && SCOPE_ERROR.test(err.message)) {
        return err.message;
      }
      return null;
    }
  });
}

const scopedTools = agentToolList.filter(
  (tool) => tool.scope !== "any" && tool.scope !== "admin",
);

describe("agent tool scopes match the verbs they call", () => {
  test.each(scopedTools.map((tool) => [tool.name, tool] as const))(
    "%s",
    async (_name, tool) => {
      expect(await scopeError(tool, [])).not.toBeNull();
      expect(await scopeError(tool, [tool.scope as Scope])).toBeNull();
    },
  );
});
