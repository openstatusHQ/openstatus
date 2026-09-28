import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { SLACK_BOT_SCOPES, missingSlackScopes } from "../slack-scopes";

describe("missingSlackScopes", () => {
  test("nothing missing when every scope was granted", () => {
    expect(missingSlackScopes(SLACK_BOT_SCOPES.join(","))).toEqual([]);
  });

  test("an install from before the incident scopes needs a reconnect", () => {
    const old =
      "app_mentions:read,assistant:write,channels:history,channels:join,chat:write,commands,groups:history,groups:read,groups:write,im:history,users:read,users:read.email";
    expect(missingSlackScopes(old)).toEqual([
      "channels:manage",
      "channels:write.invites",
      "pins:write",
      "reactions:read",
      "reactions:write",
    ]);
  });

  test("no scopes recorded means everything is missing", () => {
    expect(missingSlackScopes(undefined)).toHaveLength(SLACK_BOT_SCOPES.length);
  });
});
