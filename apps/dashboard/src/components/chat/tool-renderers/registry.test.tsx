import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";
import { renderToStaticMarkup } from "react-dom/server";

import {
  renderToolDraft,
  renderToolResult,
  summarizeToolOutput,
  toolRenderers,
} from "./index";

let warnStub: Stub | undefined;
beforeEach(() => {
  warnStub = stub(console, "warn");
});
afterEach(() => warnStub?.restore());

describe("summarizeToolOutput", () => {
  it("pluralises item counts", () => {
    expect(summarizeToolOutput("list_monitors", { items: [] })).toBe(
      "0 results",
    );
    expect(summarizeToolOutput("list_monitors", { items: [{}] })).toBe(
      "1 result",
    );
    expect(summarizeToolOutput("list_monitors", { items: [{}, {}] })).toBe(
      "2 results",
    );
  });

  it("flags paginated response logs", () => {
    expect(
      summarizeToolOutput("list_response_logs", {
        logs: [{}],
        hasMore: true,
      }),
    ).toBe("1 log (more available)");
  });

  it("prefers the search error over the count", () => {
    expect(
      summarizeToolOutput("search_docs", { error: "down", results: [{}] }),
    ).toBe("down");
    expect(summarizeToolOutput("search_docs", { results: [{}] })).toBe(
      "1 result",
    );
  });

  it("describes doc page reads", () => {
    expect(
      summarizeToolOutput("get_doc_page", {
        url: "/docs/a",
        truncated: true,
      }),
    ).toBe("read /docs/a (truncated)");
  });

  it("totals monitor summary checks", () => {
    expect(
      summarizeToolOutput("get_monitor_summary", {
        totalSuccessful: 8,
        totalDegraded: 1,
        totalFailed: 1,
        p95: 120,
      }),
    ).toBe("10 checks · p95 120ms");
  });

  it("handles a missing postmortem", () => {
    expect(summarizeToolOutput("get_postmortem", { exists: false })).toBe(
      "no postmortem",
    );
  });

  it("returns undefined while the output is pending", () => {
    expect(summarizeToolOutput("list_monitors", undefined)).toBeUndefined();
  });
});

describe("renderToolDraft", () => {
  it("builds inline drafts", () => {
    expect(
      renderToolDraft("set_incident_status", { id: 4, status: "mitigated" }),
    ).toEqual([
      { field: "incidentId", after: 4 },
      { field: "status", after: "mitigated" },
    ]);
  });

  it("includes the note only when present", () => {
    expect(
      renderToolDraft("set_incident_status", {
        id: 4,
        status: "mitigated",
        note: "rolled back",
      })?.at(-1),
    ).toEqual({ field: "note", after: "rolled back" });
  });

  it("returns undefined for read-only tools", () => {
    expect(renderToolDraft("list_monitors", {})).toBeUndefined();
  });
});

describe("renderToolResult", () => {
  it("returns undefined while the output is pending", () => {
    expect(renderToolResult("list_monitors", {}, undefined)).toBeUndefined();
  });

  it("renders a result table for list tools", () => {
    const node = renderToolResult(
      "list_status_pages",
      {},
      { items: [{ id: 1, title: "Acme", slug: "acme" }] },
    );
    expect(renderToStaticMarkup(<>{node}</>)).toContain("Acme");
  });

  it("has no result renderer for full-page reads", () => {
    expect(
      renderToolResult("get_doc_page", {}, { url: "/docs/a" }),
    ).toBeUndefined();
  });
});

describe("unknown tools", () => {
  it("fall back to undefined and warn once per name", () => {
    expect(summarizeToolOutput("not_a_tool", {})).toBeUndefined();
    expect(renderToolDraft("not_a_tool", {})).toBeUndefined();
    expect(renderToolResult("not_a_tool", {}, {})).toBeUndefined();
    expect(warnStub?.calls).toHaveLength(1);
  });
});

describe("toolRenderers", () => {
  it("gives every tool at least a summary or a renderer", () => {
    for (const [name, renderer] of Object.entries(toolRenderers)) {
      const r = renderer as Record<string, unknown>;
      expect({
        name,
        covered: Boolean(r.summary || r.renderDraft || r.renderResult),
      }).toEqual({ name, covered: true });
    }
  });
});
