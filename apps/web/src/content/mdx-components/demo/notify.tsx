import {
  atTime,
  auditRow,
  capitalize,
  demo,
  formatNumber,
  getIncidentDay,
} from "@/data/demo-data";

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

const [, identified] = demo.incident.updates;

/** One approval, three channels; the Slack card mirrors buildStatusReportBlocks. */
export function NotifyDemo() {
  const updatedAt = atTime(
    getIncidentDay(),
    auditRow("status_report.update", "→ identified").time,
  ).toISOString();
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
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{identified.time}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackAttachment tone="warning">
                <SlackAttachmentTitle>
                  {demo.incident.title} — {capitalize(identified.status)}
                </SlackAttachmentTitle>
                <SlackFields>
                  <SlackField>
                    <SlackFieldLabel>Status</SlackFieldLabel>
                    <SlackFieldValue>
                      {capitalize(identified.status)}
                    </SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Page</SlackFieldLabel>
                    <SlackFieldValue>
                      <SlackLink>{demo.company.domain}</SlackLink>
                    </SlackFieldValue>
                  </SlackField>
                </SlackFields>
                <SlackFieldValue>{identified.message}</SlackFieldValue>
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
          <div>{formatNumber(demo.subscribers.email)} sent</div>
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
