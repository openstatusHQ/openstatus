import type { RequiredScope, Scope } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  withTestTransaction,
  type WorkspaceFixture,
} from "../../test/helpers";
import { listApiKeys } from "../api-key";
import { getAuditLog, listAuditLogs } from "../audit";
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatSessions,
  setChatSessionMessages,
} from "../chat-session";
import type { ServiceContext } from "../context";
import { ForbiddenError } from "../errors";
import {
  announceIncidentChange,
  announceInChannel,
  generatePostmortemDraft,
  incidentSlackReady,
  openIncidentSlackChannel,
} from "../incident";
import { listIntegrations } from "../integration";
import { getInvitationByToken, listInvitations } from "../invitation";
import { listMembers } from "../member";
import { listGrants } from "../oauth";
import { getSlackUserMapping, listSlackUserMappings } from "../slack-user";
import { getSsoConfig, reconcileSsoDomains } from "../sso";
import { resolveStatusReport } from "../status-report";
import { getUser } from "../user";
import {
  getWorkspace,
  getWorkspaceUsage,
  isTrialEligibleWorkspace,
  listWorkspaces,
} from "../workspace";

// Verbs that live outside the scope-group folders, or gained their check
// later. Each runs once with a key one step short of its scope (refused) and
// once with exactly that scope (not refused for scope). Input is empty:
// requireScope runs before parsing or reading anything.

type Verb = (ctx: ServiceContext) => Promise<unknown>;

// The verbs take different input shapes; none is parsed before the scope
// check, so an empty object is enough to reach it.
function withEmptyInput(
  fn: (args: { ctx: ServiceContext; input: never }) => Promise<unknown>,
): Verb {
  return (ctx) => fn({ ctx, input: {} as never });
}

const SHORT_OF: Record<string, Scope[]> = {
  admin: ["write"],
  "incidents:write": ["read"],
  "incidents:read": ["monitors:write"],
  read: ["monitors:read"],
  any: [],
};

const ENOUGH: Partial<Record<RequiredScope, Scope[]>> = {
  admin: ["*"],
  any: ["monitors:read"],
};

const cases: [string, RequiredScope, Verb][] = [
  ["listApiKeys", "admin", withEmptyInput(listApiKeys)],
  ["listIntegrations", "admin", withEmptyInput(listIntegrations)],
  ["listInvitations", "admin", withEmptyInput(listInvitations)],
  ["getInvitationByToken", "admin", withEmptyInput(getInvitationByToken)],
  ["listMembers", "admin", withEmptyInput(listMembers)],
  ["listGrants", "admin", withEmptyInput(listGrants)],
  ["getSlackUserMapping", "admin", withEmptyInput(getSlackUserMapping)],
  ["listSlackUserMappings", "admin", withEmptyInput(listSlackUserMappings)],
  ["getSsoConfig", "admin", withEmptyInput(getSsoConfig)],
  ["reconcileSsoDomains", "admin", withEmptyInput(reconcileSsoDomains)],
  [
    "isTrialEligibleWorkspace",
    "admin",
    withEmptyInput(isTrialEligibleWorkspace),
  ],
  ["getUser", "admin", withEmptyInput(getUser)],
  ["createChatSession", "admin", withEmptyInput(createChatSession)],
  ["getChatSession", "admin", withEmptyInput(getChatSession)],
  ["listChatSessions", "admin", withEmptyInput(listChatSessions)],
  ["deleteChatSession", "admin", withEmptyInput(deleteChatSession)],
  ["setChatSessionMessages", "admin", withEmptyInput(setChatSessionMessages)],
  ["getWorkspace", "any", withEmptyInput(getWorkspace)],
  ["listWorkspaces", "any", withEmptyInput(listWorkspaces)],
  ["getWorkspaceUsage", "any", withEmptyInput(getWorkspaceUsage)],
  [
    "generatePostmortemDraft",
    "incidents:write",
    withEmptyInput(generatePostmortemDraft),
  ],
  [
    "openIncidentSlackChannel",
    "incidents:write",
    withEmptyInput(openIncidentSlackChannel),
  ],
  [
    "announceIncidentChange",
    "incidents:write",
    withEmptyInput(announceIncidentChange),
  ],
  ["announceInChannel", "incidents:write", withEmptyInput(announceInChannel)],
  [
    "resolveStatusReport",
    "incidents:write",
    withEmptyInput(resolveStatusReport),
  ],
  ["incidentSlackReady", "incidents:read", (ctx) => incidentSlackReady(ctx)],
  ["listAuditLogs", "read", withEmptyInput(listAuditLogs)],
  ["getAuditLog", "read", withEmptyInput(getAuditLog)],
];

let team: WorkspaceFixture;

beforeAll(async () => {
  team = await createWorkspaceFixture("team");
});

async function scopeRefusal(verb: Verb, scopes: Scope[]) {
  return withTestTransaction(async (tx) => {
    const ctx = {
      ...makeApiKeyCtx(team.workspace, {
        keyId: "narrow-key",
        userId: team.userId,
        scopes,
      }),
      db: tx,
    };
    try {
      await verb(ctx);
      return null;
    } catch (err) {
      return err instanceof ForbiddenError &&
        /lacks required scope/.test(err.message)
        ? err.message
        : null;
    }
  });
}

describe("verbs refuse a key one step short of their scope", () => {
  test.each(cases)("%s requires %s", async (_name, scope, verb) => {
    const short = SHORT_OF[scope];
    if (!short) throw new Error(`no short key defined for ${scope}`);
    expect(await scopeRefusal(verb, short)).not.toBeNull();
    const enough = ENOUGH[scope] ?? [scope as Scope];
    expect(await scopeRefusal(verb, enough)).toBeNull();
  });
});
