/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { Callout } from "./_components/callout";
import { Footer } from "./_components/footer";
import {
  formatDay,
  formatLongDay,
  formatShortDay,
  plural,
} from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue, type KeyValueRow } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { Signature } from "./_components/signature";

export const MonitorDeactivationSchema = z.object({
  deactivateAt: z.coerce.date(),
  monitorCount: z.number().optional(),
  workspaceSlug: z.string().optional(),
  lastSignIn: z.coerce.date().optional(),
});

export type MonitorDeactivationProps = z.infer<
  typeof MonitorDeactivationSchema
>;

export function monitorDeactivationSubject(
  props: Pick<MonitorDeactivationProps, "deactivateAt">,
): string {
  return `Your monitors pause on ${formatShortDay(props.deactivateAt)} — one sign-in stops it`;
}

const MonitorDeactivationEmail = ({
  deactivateAt,
  monitorCount,
  workspaceSlug,
  lastSignIn,
}: MonitorDeactivationProps) => {
  const rows: KeyValueRow[] = [];
  if (workspaceSlug) {
    rows.push({ label: "Workspace", value: workspaceSlug, mono: true });
  }
  if (lastSignIn)
    rows.push({ label: "Last sign-in", value: formatDay(lastSignIn) });
  rows.push({ label: "Pauses on", value: formatDay(deactivateAt), bold: true });

  return (
    <Layout
      preview="Nothing is deleted. History and status pages stay."
      pill={{ tone: "neutral", label: "Action needed" }}
      footer={
        <Footer reason="You get this because you own a free workspace with active monitors." />
      }
    >
      <Heading
        title={`${
          monitorCount ? plural(monitorCount, "monitor") : "Your monitors"
        } will pause on ${formatLongDay(deactivateAt)}`}
      >
        Nobody has signed in to this free workspace for two months, so we pause
        its monitors to keep capacity for active accounts.
      </Heading>
      <Callout title="Nothing gets deleted">
        Monitors, check history and status pages stay exactly as they are. If
        they do pause, you can switch them back on at any time.
      </Callout>
      <KeyValue rows={rows} />
      <Actions
        primary={{
          label: "Sign in to keep them running",
          href: "https://app.openstatus.dev",
        }}
        secondary={{
          label: "Upgrade instead",
          href: "https://app.openstatus.dev/settings/billing",
        }}
      />
      <Signature />
    </Layout>
  );
};

MonitorDeactivationEmail.PreviewProps = {
  deactivateAt: new Date("2026-09-25T00:00:00Z"),
  monitorCount: 3,
  workspaceSlug: "acme-dev",
  lastSignIn: new Date("2026-07-21T00:00:00Z"),
} satisfies MonitorDeactivationProps;

export default MonitorDeactivationEmail;
