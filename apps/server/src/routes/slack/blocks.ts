import type { PendingAction } from "./confirmation-store";

interface TextObject {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
}

interface SectionBlock {
  type: "section";
  text: TextObject;
}

interface ActionsBlock {
  type: "actions";
  elements: ButtonElement[];
}

interface DividerBlock {
  type: "divider";
}

interface ButtonElement {
  type: "button";
  text: TextObject;
  action_id: string;
  value?: string;
  style?: "primary" | "danger";
}

type Block = SectionBlock | ActionsBlock | DividerBlock;

export function buildConfirmationBlocks(
  actionId: string,
  action: PendingAction["action"],
): Block[] {
  const blocks: Block[] = [];

  switch (action.type) {
    case "createStatusReport": {
      const { title, status, message, pageId, pageComponentIds } =
        action.params;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Create Status Report*\n\n*Title:* ${title}\n*Status:* ${capitalize(status)}\n*Page ID:* ${pageId}${
            pageComponentIds?.length
              ? `\n*Components:* ${pageComponentIds.join(", ")}`
              : ""
          }\n*Message:* ${message}`,
        },
      });
      blocks.push({ type: "divider" });
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve", emoji: true },
            action_id: `approve_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Approve & Notify",
              emoji: true,
            },
            action_id: `approve_notify_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            action_id: `cancel_${actionId}`,
            style: "danger",
          },
        ],
      });
      break;
    }
    case "addStatusReportUpdate": {
      const { statusReportId, status, message } = action.params;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Add Status Report Update*\n\n*Report ID:* ${statusReportId}\n*New Status:* ${capitalize(status)}\n*Message:* ${message}`,
        },
      });
      blocks.push({ type: "divider" });
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve", emoji: true },
            action_id: `approve_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Approve & Notify",
              emoji: true,
            },
            action_id: `approve_notify_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            action_id: `cancel_${actionId}`,
            style: "danger",
          },
        ],
      });
      break;
    }
    case "updateStatusReport": {
      const { statusReportId, title, pageComponentIds } = action.params;
      let text = `*Update Status Report*\n\n*Report ID:* ${statusReportId}`;
      if (title) text += `\n*New Title:* ${title}`;
      if (pageComponentIds?.length)
        text += `\n*Components:* ${pageComponentIds.join(", ")}`;
      blocks.push({ type: "section", text: { type: "mrkdwn", text } });
      blocks.push({ type: "divider" });
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve", emoji: true },
            action_id: `approve_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            action_id: `cancel_${actionId}`,
            style: "danger",
          },
        ],
      });
      break;
    }
    case "resolveStatusReport": {
      const { statusReportId, message } = action.params;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Resolve Status Report*\n\n*Report ID:* ${statusReportId}\n*Message:* ${message}`,
        },
      });
      blocks.push({ type: "divider" });
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve", emoji: true },
            action_id: `approve_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Approve & Notify",
              emoji: true,
            },
            action_id: `approve_notify_${actionId}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            action_id: `cancel_${actionId}`,
            style: "danger",
          },
        ],
      });
      break;
    }
  }

  return blocks;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
