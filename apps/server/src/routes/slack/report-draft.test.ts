import { beforeEach, describe, expect, test } from "@openstatus/test-utils";

import { reportDraftState } from "@/libs/test/doubles/report-draft-model.mock";
import { busyChannelHistory } from "@/libs/test/slack-incident-fixtures";

import {
  type DraftCandidates,
  draftStatusReport,
  loadDraft,
  storeDraft,
  validateDraft,
} from "./report-draft";

const candidates: DraftCandidates = {
  pages: [
    { id: 1, title: "Public" },
    { id: 2, title: "Internal" },
  ],
  components: [
    { id: 10, pageId: 1, name: "API", failing: false },
    { id: 11, pageId: 1, name: "Dashboard", failing: false },
    { id: 20, pageId: 2, name: "Workers", failing: false },
  ],
};

const incidentStartedAt = new Date("2026-10-16T08:30:00Z");
const now = new Date("2026-10-16T08:35:00Z");

const modelDraft = {
  pageId: 1,
  componentIds: [11, 99, 20, 11],
  impact: "partial_outage" as const,
  message: " The dashboard is returning errors. We are investigating. ",
  startedAt: "2026-10-15T21:10:00Z",
  startedAtSource: "first error reported in the channel",
};

describe("validateDraft", () => {
  test("drops unknown and other-page components and duplicates", () => {
    const draft = validateDraft(modelDraft, candidates, incidentStartedAt, now);
    expect(draft).toEqual({
      pageId: 1,
      componentIds: [11],
      impact: "partial_outage",
      message: "The dashboard is returning errors. We are investigating.",
      startedAt: Math.floor(Date.parse("2026-10-15T21:10:00Z") / 1000),
      startedAtSource: "first error reported in the channel",
    });
  });

  test("an unknown page falls back to the failing component's page", () => {
    const draft = validateDraft(
      { ...modelDraft, pageId: 42, componentIds: [] },
      {
        ...candidates,
        components: candidates.components.map((c) => ({
          ...c,
          failing: c.id === 20,
        })),
      },
      incidentStartedAt,
      now,
    );
    expect(draft?.pageId).toBe(2);
  });

  test("no page fits, no draft", () => {
    expect(
      validateDraft(
        { ...modelDraft, pageId: null },
        candidates,
        incidentStartedAt,
        now,
      ),
    ).toBeUndefined();
  });

  test("keeps a start only when it is earlier, past and recent", () => {
    const at = (startedAt: string | null) =>
      validateDraft(
        { ...modelDraft, startedAt },
        candidates,
        incidentStartedAt,
        now,
      )?.startedAt;
    expect(at("2026-10-16T09:00:00Z")).toBeUndefined();
    expect(at("2026-08-01T00:00:00Z")).toBeUndefined();
    expect(at("not a date")).toBeUndefined();
    expect(at(null)).toBeUndefined();
  });

  test("no pages, no draft", () => {
    expect(
      validateDraft(
        modelDraft,
        { pages: [], components: [] },
        incidentStartedAt,
      ),
    ).toBeUndefined();
  });
});

describe("draftStatusReport", () => {
  beforeEach(() => {
    reportDraftState.calls = [];
  });

  const incident = {
    title: "Dashboard errors",
    summary: "Staging rename dropped grants",
    startedAt: incidentStartedAt,
  };

  test("sends the conversation and the pages, marking failing monitors", async () => {
    reportDraftState.impl = () => Promise.resolve(modelDraft);
    await draftStatusReport({
      incident,
      sourceMessages: [...busyChannelHistory].reverse(),
      candidates: {
        ...candidates,
        components: candidates.components.map((c) => ({
          ...c,
          failing: c.id === 10,
        })),
      },
    });
    const prompt = reportDraftState.calls[0]?.prompt ?? "";
    expect(prompt).toContain("Incident: Dashboard errors");
    expect(prompt).toContain("- 10: API (monitor failing)");
    expect(prompt).toContain("[2026-10-15 21:10 UTC] <@U_ENGINEER>");
  });

  test("with no failing monitors, only the conversation points at components", async () => {
    reportDraftState.impl = () => Promise.resolve(modelDraft);
    await draftStatusReport({ incident, sourceMessages: [], candidates });
    const prompt = reportDraftState.calls[0]?.prompt ?? "";
    expect(prompt).not.toContain("monitor failing");
    expect(prompt).toContain("(no channel messages)");
  });

  test("a model failure gives no draft instead of throwing", async () => {
    reportDraftState.impl = () => Promise.reject(new Error("timeout"));
    expect(
      await draftStatusReport({ incident, sourceMessages: [], candidates }),
    ).toBeUndefined();
  });

  test("a workspace without pages never calls the model", async () => {
    expect(
      await draftStatusReport({
        incident,
        sourceMessages: [],
        candidates: { pages: [], components: [] },
      }),
    ).toBeUndefined();
    expect(reportDraftState.calls).toHaveLength(0);
  });
});

describe("stored drafts", () => {
  test("round-trip by id", async () => {
    const draft = {
      pageId: 1,
      componentIds: [11],
      impact: "major_outage" as const,
      message: "Down.",
    };
    const id = await storeDraft(draft);
    expect(await loadDraft(id)).toEqual(draft);
    expect(await loadDraft("missing")).toBeUndefined();
  });
});
