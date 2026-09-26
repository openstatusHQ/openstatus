import { AccessDemo } from "./access";
import { AlertDemo } from "./alert";
import { AssertionsDemo } from "./assertions";
import { AuditDemo, StatusReportDemo } from "./audit";
import { ComponentsDemo } from "./components";
import { ImportDemo } from "./import";
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

// A new demo is a new key here, reviewed in a PR. MDX never composes blocks by hand.
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
} as const;

export type DemoType = keyof typeof demos;
export const DEMO_TYPES = Object.keys(demos) as DemoType[];

/** A live product moment from `data/demo-data.ts`, picked by `type`. */
export function Demo({ type }: { type: DemoType }) {
  const Component = demos[type];
  if (!Component) throw new Error(`Unknown demo type "${type}"`);
  return <Component />;
}
