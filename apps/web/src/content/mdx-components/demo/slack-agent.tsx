import { Button } from "@openstatus/ui/components/ui/button";

import { capitalize, demo, formatNumber } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellHeader,
  CellKey,
  CellKeyValues,
  CellRow,
  CellTitle,
  CellValue,
  toneClass,
} from "./cell";
import {
  SlackAppBadge,
  SlackAuthor,
  SlackAvatar,
  SlackLink,
  SlackMessage,
  SlackMessageBody,
  SlackMessageContent,
  SlackMessageMeta,
  SlackTime,
} from "./slack";

const [investigating] = demo.incident.updates;

/** Declare the incident from the thread: ask, review the draft, approve. */
export function SlackAgentDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{demo.company.slackChannel}</CellTitle>
        <CellDescription>thread</CellDescription>
      </CellHeader>
      <CellBody className="space-y-4">
        <SlackMessage>
          <SlackAvatar>{demo.company.oncall.initials}</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>{demo.company.oncall.name}</SlackAuthor>
              <SlackTime>{investigating.time}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackLink>@openstatus</SlackLink> checkout API is returning 503s
              from every EU region, US is fine. Open a status report?
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{investigating.time}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <Cell className="mt-1">
                <CellHeader>
                  <CellTitle>Draft status report</CellTitle>
                </CellHeader>
                <CellKeyValues>
                  <CellKey>Title</CellKey>
                  <CellValue>{demo.incident.title}</CellValue>
                  <CellKey>Status</CellKey>
                  <CellValue className={toneClass.warning}>
                    {capitalize(investigating.status)}
                  </CellValue>
                  <CellKey>Affected</CellKey>
                  <CellValue>{demo.incident.affected.join(", ")}</CellValue>
                  <CellKey>Message</CellKey>
                  <CellValue className="text-pretty">
                    {investigating.message}
                  </CellValue>
                </CellKeyValues>
                <CellRow className="flex-wrap justify-start gap-2">
                  <Button type="button" size="sm">
                    Approve
                  </Button>
                  <Button type="button" size="sm" variant="outline">
                    Approve &amp; notify
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
              <SlackTime>{investigating.time}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              Published to {demo.company.domain}.{" "}
              {formatNumber(demo.subscribers.email)} subscribers notified. Reply
              here to post the next update.
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
    </Cell>
  );
}
