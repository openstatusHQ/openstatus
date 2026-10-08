import { describe, expect, test } from "@openstatus/test-utils";

import {
  collectMentions,
  mentionLabelsFromText,
  richTextToMarkdown,
} from "./rich-text";

function section(...elements: unknown[]) {
  return { type: "rich_text_section", elements };
}

function message(...elements: unknown[]) {
  return [{ type: "rich_text", elements }];
}

describe("richTextToMarkdown", () => {
  test("returns undefined without a rich_text block", () => {
    expect(richTextToMarkdown(undefined)).toBeUndefined();
    expect(richTextToMarkdown([])).toBeUndefined();
    expect(
      richTextToMarkdown([{ type: "section", text: { type: "mrkdwn" } }]),
    ).toBeUndefined();
  });

  test("renders a standard emoji from its codepoints", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "text", text: "oh wow, it syncs omg " },
            {
              type: "emoji",
              name: "face_holding_back_tears",
              unicode: "1f979",
            },
          ),
        ),
      ),
    ).toBe("oh wow, it syncs omg 🥹");
  });

  test("renders a skin-tone sequence", () => {
    expect(
      richTextToMarkdown(
        message(
          section({
            type: "emoji",
            name: "+1",
            skin_tone: 3,
            unicode: "1f44d-1f3fc",
          }),
        ),
      ),
    ).toBe("👍🏼");
  });

  test("keeps a custom emoji as its shortcode", () => {
    expect(
      richTextToMarkdown(
        message(section({ type: "emoji", name: "partyparrot" })),
      ),
    ).toBe(":partyparrot:");
  });

  test("converts styles to markdown", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "text", text: "bold", style: { bold: true } },
            { type: "text", text: " " },
            { type: "text", text: "italic", style: { italic: true } },
            { type: "text", text: " " },
            { type: "text", text: "gone", style: { strike: true } },
            { type: "text", text: " " },
            { type: "text", text: "a*b", style: { code: true } },
          ),
        ),
      ),
    ).toBe("**bold** _italic_ ~~gone~~ `a*b`");
  });

  test("keeps surrounding whitespace outside style markers", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "text", text: "rolled back ", style: { bold: true } },
            { type: "text", text: "to v41" },
          ),
        ),
      ),
    ).toBe("**rolled back** to v41");
  });

  test("converts links with and without a label", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "link", url: "https://example.com/run/1", text: "the run" },
            { type: "text", text: " and " },
            { type: "link", url: "https://example.com" },
          ),
        ),
      ),
    ).toBe("[the run](https://example.com/run/1) and <https://example.com>");
  });

  test("names mentions from the map and falls back to the id", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "user", user_id: "U1" },
            { type: "text", text: " ping " },
            { type: "user", user_id: "U2" },
            { type: "text", text: " in " },
            { type: "channel", channel_id: "C1" },
            { type: "text", text: " " },
            { type: "channel", channel_id: "C2" },
          ),
        ),
        {
          users: new Map([["U1", "Maximilian Kaske"]]),
          channels: new Map([["C1", "inc-db"]]),
        },
      ),
    ).toBe("@Maximilian Kaske ping @U2 in #inc-db #C2");
  });

  test("escapes markdown specials in names and plain text", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "user", user_id: "U1" },
            { type: "text", text: " said 2*3 is_fine [sic]" },
          ),
        ),
        { users: new Map([["U1", "jo_hn"]]) },
      ),
    ).toBe("@jo\\_hn said 2\\*3 is\\_fine \\[sic\\]");
  });

  test("names a user group from the map and falls back to the id", () => {
    const blocks = message(
      section(
        { type: "usergroup", usergroup_id: "S1" },
        { type: "text", text: " " },
        { type: "usergroup", usergroup_id: "S2" },
      ),
    );
    expect(
      richTextToMarkdown(blocks, {
        usergroups: new Map([["S1", "engineering"]]),
      }),
    ).toBe("@engineering @S2");
  });

  test("renders broadcasts", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "broadcast", range: "here" },
            { type: "text", text: " db is back" },
          ),
        ),
      ),
    ).toBe("@here db is back");
  });

  test("renders lists, quotes and code blocks", () => {
    expect(
      richTextToMarkdown(
        message(
          section({ type: "text", text: "Findings:" }),
          {
            type: "rich_text_list",
            style: "bullet",
            elements: [
              section({ type: "text", text: "one" }),
              section({ type: "text", text: "two" }),
            ],
          },
          {
            type: "rich_text_list",
            style: "ordered",
            indent: 1,
            elements: [section({ type: "text", text: "nested" })],
          },
          {
            type: "rich_text_quote",
            elements: [{ type: "text", text: "quoted\nlines" }],
          },
          {
            type: "rich_text_preformatted",
            elements: [{ type: "text", text: "SELECT *\nFROM t;" }],
          },
        ),
      ),
    ).toBe(
      [
        "Findings:",
        "",
        "- one\n- two\n    1. nested",
        "",
        "> quoted\n> lines",
        "",
        "```\nSELECT *\nFROM t;\n```",
      ].join("\n"),
    );
  });

  test("escapes a line-start dash so it does not become a list", () => {
    expect(
      richTextToMarkdown(
        message(section({ type: "text", text: "- not a list" })),
      ),
    ).toBe("\\- not a list");
  });
});

describe("richTextToMarkdown edge cases", () => {
  test("honors the ordered-list offset", () => {
    expect(
      richTextToMarkdown(
        message({
          type: "rich_text_list",
          style: "ordered",
          offset: 2,
          elements: [
            section({ type: "text", text: "third" }),
            section({ type: "text", text: "fourth" }),
          ],
        }),
      ),
    ).toBe("3. third\n4. fourth");
  });

  test("escapes tildes so literal text is not struck through", () => {
    expect(
      richTextToMarkdown(
        message(section({ type: "text", text: "~~not gone~~" })),
      ),
    ).toBe("\\~\\~not gone\\~\\~");
  });

  test("widens code delimiters past the backticks inside", () => {
    expect(
      richTextToMarkdown(
        message(
          section({ type: "text", text: "a `b` c", style: { code: true } }),
          {
            type: "rich_text_preformatted",
            elements: [{ type: "text", text: "```\nx\n```" }],
          },
        ),
      ),
    ).toBe("``a `b` c``\n\n````\n```\nx\n```\n````");
  });

  test("pads inline code that starts or ends with a backtick", () => {
    expect(
      richTextToMarkdown(
        message(section({ type: "text", text: "`x", style: { code: true } })),
      ),
    ).toBe("`` `x ``");
    expect(
      richTextToMarkdown(
        message(section({ type: "text", text: "x`", style: { code: true } })),
      ),
    ).toBe("`` x` ``");
  });

  test("keeps a multi-line list item inside the item", () => {
    expect(
      richTextToMarkdown(
        message(
          {
            type: "rich_text_list",
            style: "ordered",
            offset: 9,
            elements: [section({ type: "text", text: "first\nstill first" })],
          },
          {
            type: "rich_text_list",
            style: "bullet",
            indent: 1,
            elements: [section({ type: "text", text: "a\nb" })],
          },
        ),
      ),
    ).toBe("10. first\n    still first\n    - a\n      b");
  });

  test("escapes block syntax at line start, also inside quotes", () => {
    expect(
      richTextToMarkdown(
        message(
          section({ type: "text", text: "## not a heading\n---\n+ no\n1) no" }),
          {
            type: "rich_text_quote",
            elements: [{ type: "text", text: "# q" }],
          },
        ),
      ),
    ).toBe("\\## not a heading\n\\---\n\\+ no\n\\1) no\n\n> \\# q");
  });

  test("renders a link with an unsafe scheme as plain text", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "link", url: "javascript:alert(1)", text: "click" },
            { type: "text", text: " " },
            { type: "link", url: "javascript:alert(1)" },
            { type: "text", text: " " },
            { type: "link", url: "mailto:ops@example.com" },
          ),
        ),
      ),
    ).toBe("click javascript:alert(1) <mailto:ops@example.com>");
  });

  test("encodes spaces and parentheses in link destinations", () => {
    expect(
      richTextToMarkdown(
        message(
          section(
            { type: "link", url: "https://w.org/wiki/Foo_(bar)", text: "wiki" },
            { type: "text", text: " " },
            { type: "link", url: "https://e.com/a b" },
          ),
        ),
      ),
    ).toBe("[wiki](https://w.org/wiki/Foo_%28bar%29) <https://e.com/a%20b>");
  });
});

describe("mentionLabelsFromText", () => {
  test("harvests the labels Slack spelled out in mrkdwn", () => {
    const names = mentionLabelsFromText(
      "<@U1|max> ping <!subteam^S1|@engineering> in <#C1|inc-db> and <#C2>",
    );
    expect(names.users).toEqual(new Map([["U1", "max"]]));
    expect(names.usergroups).toEqual(new Map([["S1", "engineering"]]));
    expect(names.channels).toEqual(new Map([["C1", "inc-db"]]));
  });

  test("is empty without text", () => {
    expect(mentionLabelsFromText(undefined).users?.size).toBe(0);
  });
});

describe("collectMentions", () => {
  test("dedupes user and channel ids across blocks", () => {
    expect(
      collectMentions(
        message(
          section(
            { type: "user", user_id: "U1" },
            { type: "channel", channel_id: "C1" },
          ),
          {
            type: "rich_text_quote",
            elements: [
              { type: "user", user_id: "U1" },
              { type: "user", user_id: "U2" },
            ],
          },
        ),
      ),
    ).toEqual({ users: ["U1", "U2"], channels: ["C1"] });
  });

  test("is empty without rich_text", () => {
    expect(collectMentions(undefined)).toEqual({ users: [], channels: [] });
  });

  test("finds mentions inside list items", () => {
    const blocks = message({
      type: "rich_text_list",
      style: "bullet",
      elements: [
        section(
          { type: "user", user_id: "U5" },
          { type: "text", text: " owns it" },
        ),
        section({ type: "channel", channel_id: "C5" }),
      ],
    });
    expect(collectMentions(blocks)).toEqual({
      users: ["U5"],
      channels: ["C5"],
    });
    expect(
      richTextToMarkdown(blocks, { users: new Map([["U5", "Sam"]]) }),
    ).toBe("- @Sam owns it\n- #C5");
  });
});
