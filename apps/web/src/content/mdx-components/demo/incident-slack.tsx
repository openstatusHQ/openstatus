import { Button } from "@openstatus/ui/components/ui/button";

import {
  auditRow,
  capitalize,
  demo,
  formatNumber,
  getResponseChannel,
  hhmm,
} from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellHeader,
  CellKey,
  CellKeyValues,
  CellRow,
  CellSubheader,
  CellTitle,
  CellValue,
  toneClass,
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
  SlackReaction,
  SlackReactions,
  SlackTime,
} from "./slack";

const { response, company } = demo;
const severity = capitalize(response.severity);
const declaredAt = hhmm(auditRow("incident.create").time);
const notedAt = hhmm(auditRow("incident_event.create").time);
const mitigatedAt = hhmm(auditRow("incident.update", "→ mitigated").time);
const monitoring = demo.incident.updates.find((u) => u.status === "monitoring");

/** One slash command, one approval, and the incident has a channel. */
export function IncidentDeclareDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{company.slackChannel}</CellTitle>
        <CellDescription>slash command</CellDescription>
      </CellHeader>
      <CellBody className="space-y-4">
        <SlackMessage>
          <SlackAvatar>{company.oncall.initials}</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>{company.oncall.name}</SlackAuthor>
              <SlackTime>{declaredAt}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackCode>
                /openstatus incident declare {response.title} --sev{" "}
                {response.severity}
              </SlackCode>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{declaredAt}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <Cell className="mt-1">
                <CellHeader>
                  <CellTitle>Declare incident</CellTitle>
                </CellHeader>
                <CellKeyValues>
                  <CellKey>Title</CellKey>
                  <CellValue>{response.title}</CellValue>
                  <CellKey>Severity</CellKey>
                  <CellValue className={toneClass.warning}>
                    {severity}
                  </CellValue>
                </CellKeyValues>
                <CellRow className="flex-wrap justify-start gap-2">
                  <Button type="button" size="sm">
                    Approve
                  </Button>
                  <Button type="button" size="sm" variant="ghost">
                    Cancel
                  </Button>
                </CellRow>
              </Cell>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{declaredAt}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              Incident{" "}
              <span className="text-foreground font-medium">
                {response.title}
              </span>{" "}
              declared ({response.severity}).{" "}
              <SlackLink>Open in openstatus</SlackLink>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
      <CellFooter>
        <span>
          Channel <SlackLink>{getResponseChannel()}</SlackLink> opened
        </span>
        <span>{company.oncall.name} invited</span>
      </CellFooter>
    </Cell>
  );
}

/** The incident's own channel: pinned card on top, a message added from its ⋯ menu or with 📌 becomes a timeline note. */
export function IncidentChannelDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{getResponseChannel()}</CellTitle>
        <CellDescription>
          {response.severity.toUpperCase()} · open
        </CellDescription>
      </CellHeader>
      <CellBody className="space-y-4">
        <SlackMessage>
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{declaredAt} · pinned</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackAttachment tone="warning">
                <SlackAttachmentTitle>{response.title}</SlackAttachmentTitle>
                <SlackFields>
                  <SlackField>
                    <SlackFieldLabel>Severity</SlackFieldLabel>
                    <SlackFieldValue>{severity}</SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Status</SlackFieldLabel>
                    <SlackFieldValue>Open</SlackFieldValue>
                  </SlackField>
                </SlackFields>
                <div className="text-muted-foreground text-xs">
                  <SlackLink>Open in openstatus</SlackLink> · Add a message to
                  the timeline: ⋯ → Add to incident timeline, or react 📌.
                </div>
              </SlackAttachment>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar>{company.oncall.initials}</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>{company.oncall.name}</SlackAuthor>
              <SlackTime>{notedAt}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>{response.note}</SlackMessageBody>
            <SlackReactions>
              <SlackReaction>📌 1</SlackReaction>
              <SlackReaction>✅ 1</SlackReaction>
            </SlackReactions>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
      <CellFooter>
        <span>Any message can go on the timeline</span>
        <span>
          Reminder after {response.staleAfterHours}h without an update
        </span>
      </CellFooter>
    </Cell>
  );
}

/** Internal status from the channel; the public report keeps its own wording. */
export function IncidentStatusDemo() {
  if (!monitoring) throw new Error("No monitoring update");
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{getResponseChannel()}</CellTitle>
        <CellDescription>slash command</CellDescription>
      </CellHeader>
      <CellBody className="space-y-4">
        <SlackMessage>
          <SlackAvatar>{company.oncall.initials}</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>{company.oncall.name}</SlackAuthor>
              <SlackTime>{mitigatedAt}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackCode>
                /openstatus incident mitigate {response.mitigation}
              </SlackCode>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{mitigatedAt}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              Incident{" "}
              <span className="text-foreground font-medium">
                {response.title}
              </span>{" "}
              is now <span className={toneClass.warning}>mitigated</span>.
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
      <CellSubheader>Linked status report</CellSubheader>
      <CellRow>
        <span className="truncate">{demo.incident.title}</span>
        <span className={toneClass.info}>{capitalize(monitoring.status)}</span>
      </CellRow>
      <CellBody className="text-muted-foreground text-xs text-pretty">
        {monitoring.message}
      </CellBody>
      <CellFooter>
        <span>Internal status and public update move separately</span>
        <span>{formatNumber(demo.subscribers.email)} subscribers notified</span>
      </CellFooter>
    </Cell>
  );
}
