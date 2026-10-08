import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { buildHomeBlocks, OPEN_DECLARE_INCIDENT_ACTION } from "./home";

describe("buildHomeBlocks", () => {
  test("hides incidents without a list", () => {
    const text = JSON.stringify(buildHomeBlocks());
    expect(text).not.toContain(OPEN_DECLARE_INCIDENT_ACTION);
    expect(text).not.toContain("incident declare");
  });

  test("lists open incidents with the declare button", () => {
    const text = JSON.stringify(
      buildHomeBlocks({
        openIncidents: [
          {
            id: 7,
            title: "API <down>",
            severity: "critical",
            status: "open",
            url: "https://app.test/incidents/7",
            slackChannelId: "C_INC",
          },
        ],
      }),
    );
    expect(text).toContain(OPEN_DECLARE_INCIDENT_ACTION);
    expect(text).toContain("<https://app.test/incidents/7|API &lt;down&gt;>");
    expect(text).toContain("<#C_INC>");
    expect(text).toContain(
      "API &lt;down&gt;>*  ·  Critical  ·  Open  ·  #7  ·  <#C_INC>",
    );
    expect(text).toContain("/openstatus incident declare");
  });

  test("says so when nothing is open", () => {
    expect(JSON.stringify(buildHomeBlocks({ openIncidents: [] }))).toContain(
      "No open incidents",
    );
  });
});
