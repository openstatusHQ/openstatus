import { AccessDemo } from "./access";
import { AlertDemo } from "./alert";
import { AssertionsDemo } from "./assertions";
import { AuditDemo, StatusReportDemo } from "./audit";
import { ComponentsDemo } from "./components";
import { ImportDemo } from "./import";
import { IncidentDemo, PostmortemDemo } from "./incident";
import {
  IncidentChannelDemo,
  IncidentDeclareDemo,
  IncidentStatusDemo,
} from "./incident-slack";
import { LogsDemo } from "./logs";
import { MaintenanceDemo } from "./maintenance";
import { MonitorDemo } from "./monitor";
import { NotifyDemo } from "./notify";
import { PrivateLocationDemo } from "./private-location";
import { RegionsDemo } from "./regions";
import { SlackAgentDemo } from "./slack-agent";
import { StatusPageDemo } from "./status-page";
import { SubscriptionsDemo } from "./subscriptions";
import { TerminalDemo } from "./terminal";
import { ThemesDemo } from "./themes";
import { TimingDemo } from "./timing";
import { TranslationsDemo } from "./translations";

const demos = {
  "status-page": StatusPageDemo,
  alert: AlertDemo,
  "slack-agent": SlackAgentDemo,
  notify: NotifyDemo,
  access: AccessDemo,
  "status-report": StatusReportDemo,
  audit: AuditDemo,
  components: ComponentsDemo,
  subscriptions: SubscriptionsDemo,
  translations: TranslationsDemo,
  themes: ThemesDemo,
  import: ImportDemo,
  maintenance: MaintenanceDemo,
  terminal: TerminalDemo,
  monitor: MonitorDemo,
  regions: RegionsDemo,
  assertions: AssertionsDemo,
  "private-location": PrivateLocationDemo,
  timing: TimingDemo,
  logs: LogsDemo,
  incident: IncidentDemo,
  "incident-declare": IncidentDeclareDemo,
  "incident-channel": IncidentChannelDemo,
  "incident-status": IncidentStatusDemo,
  postmortem: PostmortemDemo,
} as const;

export type DemoType = keyof typeof demos;

/** A live product moment from `data/demo-data.ts`, picked by `type`. */
export function Demo({ type }: { type: DemoType }) {
  const Component = demos[type];
  // MDX passes a string, so the key is only checked here.
  if (!Component) throw new Error(`Unknown demo type "${type}"`);
  return (
    <div className="not-prose my-6">
      <Component />
    </div>
  );
}
