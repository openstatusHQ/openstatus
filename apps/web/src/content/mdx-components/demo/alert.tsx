import { Button } from "@openstatus/ui/components/ui/button";

import {
  atTime,
  auditRow,
  demo,
  formatNumber,
  getIncidentDay,
  hhmm,
} from "@/data/demo-data";

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
const slowest = failingRegions.reduce((a, b) => (b.ms > a.ms ? b : a));
const alsoSent = demo.channels.filter(
  (c) => c.name !== "Slack" && c.state !== "off",
);

/** Four regions confirm the 503; the alert lands in Slack, mirroring `buildAlertBlocks`. */
export function AlertDemo() {
  const alert = auditRow("monitor.alert");
  const cronTimestamp = atTime(getIncidentDay(), alert.time).toISOString();
  const failed = demo.monitor.assertions.find((a) => !a.pass && "got" in a);
  if (!failed) throw new Error("No failed assertion with a response");
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{demo.company.slackChannel}</CellTitle>
        <CellDescription>openstatus · alert</CellDescription>
      </CellHeader>
      <CellBody>
        <SlackMessage>
          <SlackAvatar variant="app" />
          <SlackMessageContent>
            <SlackMessageMeta>
              <SlackAuthor>openstatus</SlackAuthor>
              <SlackAppBadge />
              <SlackTime>{hhmm(alert.time)}</SlackTime>
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
                      {failed.got}
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
                      {formatNumber(slowest.ms)} ms
                    </SlackFieldValue>
                  </SlackField>
                  <SlackField>
                    <SlackFieldLabel>Cron Timestamp</SlackFieldLabel>
                    <SlackFieldValue>{cronTimestamp}</SlackFieldValue>
                  </SlackField>
                </SlackFields>
                <SlackField className="text-xs">
                  <SlackFieldLabel className="mb-1">Error</SlackFieldLabel>
                  <CellPre className="border-border border break-words whitespace-pre-wrap">
                    {`Expected status code ${failed.value}, received ${failed.got}`}
                  </CellPre>
                </SlackField>
                <Button size="sm" variant="outline" type="button">
                  View Dashboard
                </Button>
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
