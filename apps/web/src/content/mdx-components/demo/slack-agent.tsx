import { Button } from "@openstatus/ui/components/ui/button";

import { demo } from "@/data/demo-data";

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

// The first update: drafted at 09:44, published the same minute (see `demo.audit`).
const [investigating] = demo.incident.updates;

/** Declare the incident from the thread: ask, review the draft, approve. */
export function SlackAgentDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle># incidents</CellTitle>
        <CellDescription>thread · 3 replies</CellDescription>
      </CellHeader>
      <CellBody className="space-y-4">
        <SlackMessage>
          <SlackAvatar>BG</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>Bertram G.</SlackAuthor>
              <SlackTime>09:44</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackLink>@openstatus</SlackLink> checkout API is returning 503s
              from every EU region, US is fine. Open a status report?
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar variant="app">os</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>09:44</SlackTime>
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
                    Investigating
                  </CellValue>
                  <CellKey>Affected</CellKey>
                  <CellValue>{demo.incident.affected.join(", ")}</CellValue>
                  <CellKey>Message</CellKey>
                  <CellValue className="text-pretty">
                    {investigating.message}
                  </CellValue>
                </CellKeyValues>
                <CellRow className="flex-wrap justify-start gap-2">
                  <Button size="sm" className="rounded-none">
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-none">
                    Approve &amp; notify
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none">
                    Cancel
                  </Button>
                </CellRow>
              </Cell>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
        <SlackMessage>
          <SlackAvatar variant="app">os</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{investigating.time}</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              Published to {demo.company.domain}.{" "}
              {demo.subscribers.email.toLocaleString("en-US")} subscribers
              notified. Reply here to post the next update.
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
    </Cell>
  );
}
