/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { Callout } from "./_components/callout";
import { Footer } from "./_components/footer";
import { plural } from "./_components/format";
import { Heading } from "./_components/heading";
import { KeyValue } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { Signature } from "./_components/signature";

export const MonitorPausedSchema = z.object({
  monitorCount: z.number().optional(),
  workspaceSlug: z.string().optional(),
});

export type MonitorPausedProps = z.infer<typeof MonitorPausedSchema>;

export const MONITOR_PAUSED_SUBJECT =
  "Your monitors are paused — sign in to switch them back on";

const MonitorPausedEmail = ({
  monitorCount,
  workspaceSlug,
}: MonitorPausedProps) => {
  return (
    <Layout
      preview="Nothing was deleted. History and status pages stay."
      pill={{ tone: "neutral", label: "Account change" }}
      footer={
        <Footer reason="You get this because you own a free workspace whose monitors were paused." />
      }
    >
      <Heading
        title={`${
          monitorCount ? plural(monitorCount, "monitor") : "Your monitors"
        } ${monitorCount === 1 ? "has" : "have"} been paused`}
      >
        Nobody has signed in to this free workspace for over two months, so its
        monitors are paused. No checks run and no alerts are sent until you
        switch them back on.
      </Heading>
      <Callout title="Nothing was deleted">
        Monitors, check history and status pages are exactly as you left them.
      </Callout>
      {workspaceSlug ? (
        <KeyValue
          rows={[{ label: "Workspace", value: workspaceSlug, mono: true }]}
        />
      ) : null}
      <Actions
        primary={{
          label: "Sign in to resume",
          href: "https://app.openstatus.dev/monitors",
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

MonitorPausedEmail.PreviewProps = {
  monitorCount: 3,
  workspaceSlug: "acme-dev",
} satisfies MonitorPausedProps;

export default MonitorPausedEmail;
