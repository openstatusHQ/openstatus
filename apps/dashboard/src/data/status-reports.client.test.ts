import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { incidentEndedAt } from "./managed-incidents.client";
import {
  getActions,
  reportResolvedAt,
  reportStartedAt,
} from "./status-reports.client";

const d = (iso: string) => new Date(iso);

function report(
  status: string,
  updates: string[],
  createdAt: string | null = "2024-01-01T00:00:00Z",
  updatedAt: string | null = "2024-01-09T00:00:00Z",
) {
  return {
    status,
    createdAt: createdAt ? d(createdAt) : null,
    updatedAt: updatedAt ? d(updatedAt) : null,
    updates: updates.map((date) => ({ date: d(date) })),
  };
}

describe("reportStartedAt", () => {
  it("uses the earliest update regardless of order", () => {
    expect(
      reportStartedAt(
        report("investigating", [
          "2024-01-05T00:00:00Z",
          "2024-01-03T00:00:00Z",
        ]),
      ),
    ).toEqual(d("2024-01-03T00:00:00Z"));
  });

  it("falls back to createdAt, then the epoch", () => {
    expect(reportStartedAt(report("investigating", []))).toEqual(
      d("2024-01-01T00:00:00Z"),
    );
    expect(reportStartedAt(report("investigating", [], null))).toEqual(
      new Date(0),
    );
  });
});

describe("reportResolvedAt", () => {
  it("is null while the report is open", () => {
    expect(
      reportResolvedAt(report("monitoring", ["2024-01-05T00:00:00Z"])),
    ).toBeNull();
  });

  it("uses the latest update once resolved", () => {
    expect(
      reportResolvedAt(
        report("resolved", ["2024-01-07T00:00:00Z", "2024-01-05T00:00:00Z"]),
      ),
    ).toEqual(d("2024-01-07T00:00:00Z"));
  });

  it("falls back to updatedAt, then createdAt, for legacy reports", () => {
    expect(reportResolvedAt(report("resolved", []))).toEqual(
      d("2024-01-09T00:00:00Z"),
    );
    expect(
      reportResolvedAt(report("resolved", [], "2024-01-01T00:00:00Z", null)),
    ).toEqual(d("2024-01-01T00:00:00Z"));
  });
});

describe("getActions", () => {
  it("wires handlers by action id", () => {
    const onDelete = () => {};
    const actions = getActions({ delete: onDelete });
    expect(actions.map((a) => a.id)).toEqual(["view-report", "delete"]);
    expect(actions[0].onClick).toBeUndefined();
    expect(actions[1].onClick).toBe(onDelete);
  });
});

describe("incidentEndedAt", () => {
  const resolvedAt = d("2024-01-02T00:00:00Z");
  const closedAt = d("2024-01-03T00:00:00Z");

  it("prefers resolvedAt for resolved incidents", () => {
    expect(
      incidentEndedAt({ status: "resolved", resolvedAt, closedAt }),
    ).toEqual(resolvedAt);
  });

  it("uses closedAt for canceled incidents", () => {
    expect(
      incidentEndedAt({ status: "canceled", resolvedAt: null, closedAt }),
    ).toEqual(closedAt);
  });

  it("uses closedAt for a resolved incident missing resolvedAt", () => {
    expect(
      incidentEndedAt({ status: "resolved", resolvedAt: null, closedAt }),
    ).toEqual(closedAt);
  });

  it("is null while ongoing", () => {
    expect(
      incidentEndedAt({ status: "open", resolvedAt: null, closedAt: null }),
    ).toBeNull();
  });
});
