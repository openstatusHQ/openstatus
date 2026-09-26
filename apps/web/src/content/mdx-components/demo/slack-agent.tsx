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

const [, identified] = demo.incident.updates;

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
          <SlackAvatar>MK</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>Marie K.</SlackAuthor>
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
                    Identified
                  </CellValue>
                  <CellKey>Affected</CellKey>
                  <CellValue>{demo.incident.affected.join(", ")}</CellValue>
                  <CellKey>Message</CellKey>
                  <CellValue className="text-pretty">
                    {identified.message}
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
              <SlackTime>09:52</SlackTime>
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
