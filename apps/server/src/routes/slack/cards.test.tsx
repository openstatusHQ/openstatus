/** @jsxImportSource chat */
import { describe, expect, test } from "bun:test";
import { fromReactElement } from "chat";
import { ConfirmationCard, buildConfirmationCard } from "./cards";
import type { PendingAction } from "./confirmation-store";

function renderCard(actionId: string, action: PendingAction["action"]) {
  return fromReactElement(
    <ConfirmationCard actionId={actionId} action={action} />,
  );
}

describe("ConfirmationCard", () => {
  test("renders createStatusReport card", () => {
    const card = renderCard("abc123", {
      type: "createStatusReport",
      params: {
        title: "API Down",
        status: "investigating",
        message: "Investigating the issue",
        pageId: 1,
      },
    });
    expect(card).toBeDefined();
  });

  test("renders addStatusReportUpdate card", () => {
    const card = renderCard("abc123", {
      type: "addStatusReportUpdate",
      params: {
        statusReportId: 1,
        status: "identified",
        message: "Root cause found",
      },
    });
    expect(card).toBeDefined();
  });

  test("renders updateStatusReport card", () => {
    const card = renderCard("abc123", {
      type: "updateStatusReport",
      params: {
        statusReportId: 1,
        title: "Updated Title",
      },
    });
    expect(card).toBeDefined();
  });

  test("renders resolveStatusReport card", () => {
    const card = renderCard("abc123", {
      type: "resolveStatusReport",
      params: {
        statusReportId: 1,
        message: "Issue resolved",
      },
    });
    expect(card).toBeDefined();
  });

  test("renders createMaintenance card", () => {
    const card = renderCard("abc123", {
      type: "createMaintenance",
      params: {
        title: "DB Migration",
        message: "Scheduled database migration",
        from: "2025-03-14T14:00:00Z",
        to: "2025-03-14T15:00:00Z",
        pageId: 1,
      },
    });
    expect(card).toBeDefined();
  });
});

describe("buildConfirmationCard", () => {
  test("returns a ChatElement", () => {
    const element = buildConfirmationCard("abc123", {
      type: "createStatusReport",
      params: {
        title: "Test",
        status: "investigating",
        message: "Test message",
        pageId: 1,
      },
    });
    expect(element).toBeDefined();
  });
});
