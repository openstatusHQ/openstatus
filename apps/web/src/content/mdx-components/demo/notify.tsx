import { atTime, demo, getIncidentDay } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellGrid,
  CellGridItem,
  CellHeader,
  CellLabel,
  CellTitle,
} from "./cell";
import {
  SlackAppBadge,
  SlackAttachment,
  SlackAttachmentTitle,
  SlackAuthor,
  SlackAvatar,
  SlackCode,
  SlackField,
  SlackFieldLabel,
  SlackFields,
  SlackFieldValue,
  SlackLink,
  SlackMessage,
  SlackMessageBody,
  SlackMessageContent,
  SlackMessageMeta,
  SlackTime,
} from "./slack";

// The 09:52 update, the one the audit log records as `status_report.update → identified`.
const [, identified] = demo.incident.updates;
const updatedAt = atTime(getIncidentDay(), "09:52:40").toISOString();

/** One approval, three channels: email, feeds, and the shared Slack channel. */
export function NotifyDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>
          # {demo.company.slug}-{demo.company.customer.toLowerCase()}
        </CellTitle>
        <CellDescription>
          Slack Connect · shared with {demo.company.customer}
        </CellDescription>
      </CellHeader>
      <CellBody>
        <SlackMessage>
          <SlackAvatar variant="app">os</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{identified.time}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              {/* Mirrors `buildStatusReportBlocks` in @openstatus/subscriptions. */}
              <SlackAttachment tone="warning">
                <SlackAttachmentTitle>
                  {demo.incident.title} — Identified
                </SlackAttachmentTitle>
                <SlackFields>
                  <SlackField>
                    <SlackFieldLabel>Status</SlackFieldLabel>
                    <SlackFieldValue>Identified</SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Page</SlackFieldLabel>
                    <SlackFieldValue>
                      <SlackLink>{demo.company.domain}</SlackLink>
                    </SlackFieldValue>
                  </SlackField>
                </SlackFields>
                <div>{identified.message}</div>
                <SlackField className="text-xs">
                  <SlackFieldLabel>Affected</SlackFieldLabel>
                  <SlackFieldValue>
                    {demo.incident.affected.join(", ")}
                  </SlackFieldValue>
                </SlackField>
                <div className="text-muted-foreground text-xs">
                  Updated {updatedAt} · <SlackLink>View details</SlackLink> ·
                  Manage with <SlackCode>/openstatus unsubscribe</SlackCode>
                </div>
              </SlackAttachment>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
      <CellGrid cols={3} className="text-xs">
        <CellGridItem>
          <CellLabel>Email</CellLabel>
          <div>{demo.subscribers.email.toLocaleString("en-US")} sent</div>
        </CellGridItem>
        <CellGridItem>
          <CellLabel>RSS / Atom</CellLabel>
          <div>feed updated</div>
        </CellGridItem>
        <CellGridItem>
          <CellLabel>Slack Connect</CellLabel>
          <div>{demo.subscribers.slackConnect} workspaces</div>
        </CellGridItem>
      </CellGrid>
    </Cell>
  );
}
