/** @jsxImportSource chat */
import {
  Actions,
  Button,
  Card,
  CardText,
  type ChatElement,
  Divider,
} from "chat";
import type { PendingAction } from "./confirmation-store";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ConfirmationCard({
  actionId,
  action,
}: {
  actionId: string;
  action: PendingAction["action"];
}) {
  switch (action.type) {
    case "createStatusReport": {
      const { title, status, message, pageId, pageComponentIds } =
        action.params;
      return (
        <Card title="Create Status Report">
          <CardText>
            {`**Title:** ${title}\n**Status:** ${capitalize(status)}\n**Page ID:** ${pageId}${
              pageComponentIds?.length
                ? `\n**Components:** ${pageComponentIds.join(", ")}`
                : ""
            }\n**Message:** ${message}`}
          </CardText>
          <Divider />
          <Actions>
            <Button id="approve" value={actionId} style="primary">
              Approve
            </Button>
            <Button id="approve_notify" value={actionId} style="primary">
              Approve & Notify
            </Button>
            <Button id="cancel" value={actionId} style="danger">
              Cancel
            </Button>
          </Actions>
        </Card>
      );
    }
    case "addStatusReportUpdate": {
      const { statusReportId, status, message } = action.params;
      return (
        <Card title="Add Status Report Update">
          <CardText>
            {`**Report ID:** ${statusReportId}\n**New Status:** ${capitalize(status)}\n**Message:** ${message}`}
          </CardText>
          <Divider />
          <Actions>
            <Button id="approve" value={actionId} style="primary">
              Approve
            </Button>
            <Button id="approve_notify" value={actionId} style="primary">
              Approve & Notify
            </Button>
            <Button id="cancel" value={actionId} style="danger">
              Cancel
            </Button>
          </Actions>
        </Card>
      );
    }
    case "updateStatusReport": {
      const { statusReportId, title, pageComponentIds } = action.params;
      let text = `**Report ID:** ${statusReportId}`;
      if (title) text += `\n**New Title:** ${title}`;
      if (pageComponentIds?.length)
        text += `\n**Components:** ${pageComponentIds.join(", ")}`;
      return (
        <Card title="Update Status Report">
          <CardText>{text}</CardText>
          <Divider />
          <Actions>
            <Button id="approve" value={actionId} style="primary">
              Approve
            </Button>
            <Button id="cancel" value={actionId} style="danger">
              Cancel
            </Button>
          </Actions>
        </Card>
      );
    }
    case "resolveStatusReport": {
      const { statusReportId, message } = action.params;
      return (
        <Card title="Resolve Status Report">
          <CardText>
            {`**Report ID:** ${statusReportId}\n**Message:** ${message}`}
          </CardText>
          <Divider />
          <Actions>
            <Button id="approve" value={actionId} style="primary">
              Approve
            </Button>
            <Button id="approve_notify" value={actionId} style="primary">
              Approve & Notify
            </Button>
            <Button id="cancel" value={actionId} style="danger">
              Cancel
            </Button>
          </Actions>
        </Card>
      );
    }
    case "createMaintenance": {
      const { title, message, from, to, pageComponentIds } = action.params;
      return (
        <Card title="Schedule Maintenance">
          <CardText>
            {`**Title:** ${title}\n**From:** ${formatDate(from)}\n**To:** ${formatDate(to)}${
              pageComponentIds?.length
                ? `\n**Components:** ${pageComponentIds.join(", ")}`
                : ""
            }\n**Message:** ${message}`}
          </CardText>
          <Divider />
          <Actions>
            <Button id="approve" value={actionId} style="primary">
              Approve
            </Button>
            <Button id="approve_notify" value={actionId} style="primary">
              Approve & Notify
            </Button>
            <Button id="cancel" value={actionId} style="danger">
              Cancel
            </Button>
          </Actions>
        </Card>
      );
    }
  }
}

export function buildConfirmationCard(
  actionId: string,
  action: PendingAction["action"],
): ChatElement {
  return <ConfirmationCard actionId={actionId} action={action} />;
}
