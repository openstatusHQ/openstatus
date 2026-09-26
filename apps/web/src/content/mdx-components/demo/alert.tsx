import { demo } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellHeader,
  CellPre,
  CellTitle,
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
  SlackMessage,
  SlackMessageBody,
  SlackMessageContent,
  SlackMessageMeta,
  SlackTime,
} from "./slack";

const failingRegions = demo.regions.filter((r) => r.status !== 200);
const [slowest] = failingRegions;
const alsoSent = demo.channels.filter(
  (c) => c.name !== "Slack" && c.state !== "off",
);

/** Three regions confirm the 503; the alert lands in Slack, mirroring `buildAlertBlocks`. */
export function AlertDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle># incidents</CellTitle>
        <CellDescription>openstatus · alert</CellDescription>
      </CellHeader>
      <CellBody>
        <SlackMessage>
          <SlackAvatar variant="app">os</SlackAvatar>
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>09:41</SlackTime>
            </SlackMessageMeta>
            <SlackMessageBody>
              <SlackAttachment tone="destructive">
                <SlackAttachmentTitle>
                  {demo.monitor.name} is failing
                </SlackAttachmentTitle>
                <SlackCode className="inline-block px-1.5">
                  {demo.monitor.method} {demo.monitor.url}
                </SlackCode>
                <SlackFields className="border-border border-t pt-3">
                  <SlackField>
                    <SlackFieldLabel>Status</SlackFieldLabel>
                    <SlackFieldValue className={toneClass.destructive}>
                      503 Service Unavailable
                    </SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Regions</SlackFieldLabel>
                    <SlackFieldValue>
                      {failingRegions.map((r) => r.code).join(", ")}
                    </SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Latency</SlackFieldLabel>
                    <SlackFieldValue>
                      {slowest.ms.toLocaleString("en-US")} ms
                    </SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Cron Timestamp</SlackFieldLabel>
                    <SlackFieldValue>2026-09-26T09:41:12.000Z</SlackFieldValue>
                  </SlackField>
                </SlackFields>
                <SlackField className="text-xs">
                  <SlackFieldLabel className="mb-1">Error</SlackFieldLabel>
                  <CellPre className="border-border border break-words whitespace-pre-wrap">
                    Expected status code 200, received 503
                  </CellPre>
                </SlackField>
                <span className="border-border text-foreground inline-block border px-2 py-1 text-xs font-medium">
                  View Dashboard
                </span>
              </SlackAttachment>
            </SlackMessageBody>
          </SlackMessageContent>
        </SlackMessage>
      </CellBody>
      <CellFooter>
        <span>
          Also{" "}
          {alsoSent.map((c, i) => (
            <span key={c.name}>
              {i > 0 ? " · " : null}
              {c.name} <span className={toneClass.success}>{c.state}</span>
            </span>
          ))}
        </span>
        <span>
          {failingRegions.length} of {demo.regions.length} regions failed the
          assertion
        </span>
      </CellFooter>
    </Cell>
  );
}
