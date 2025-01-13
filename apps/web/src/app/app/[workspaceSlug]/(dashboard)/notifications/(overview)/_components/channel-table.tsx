import { env } from "@/env";
import type { Workspace } from "@openstatus/db/src/schema";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";

import { Button, Separator } from "@openstatus/ui";
import Link from "next/link";

// FIXME: create a Channel Component within the file to avoid code duplication

interface ChannelTable {
  workspace: Workspace;
  disabled?: boolean;
}

export default function ChannelTable({ workspace, disabled }: ChannelTable) {
  return (
    <div className="col-span-full w-full rounded-lg border border-border border-dashed bg-background p-8">
      <h2 className="font-cal text-2xl">Channels</h2>
      <h3 className="text-muted-foreground">Connect all your channels</h3>
      <div className="mt-4 rounded-md border">
        <Channel
          title="Discord"
          description="Send notifications to discord."
          href="./notifications/new/discord"
          disabled={disabled}
        />
        <Separator />
        <Channel
          title="Email"
          description="Send notifications by email."
          href="./notifications/new/email"
          disabled={disabled}
        />
        <Separator />
        <Channel
          title="PagerDuty"
          description="Send notifications to PagerDuty."
          href={`https://app.pagerduty.com/install/integration?app_id=${env.PAGERDUTY_APP_ID}&redirect_url=${
            process.env.NODE_ENV === "development" // FIXME: This sucks
              ? "http://localhost:3000"
              : "https://www.openstatus.dev"
          }/api/callback/pagerduty?workspace=${workspace.slug}&version=2`}
          disabled={disabled || !workspace.limits.pagerduty}
        />
        <Separator />
        <Channel
          title="Slack"
          description="Send notifications to Slack."
          href="./notifications/new/slack"
          disabled={disabled}
        />
        <Separator />
        <Channel
          title="SMS"
          description="Send notifications to your phones."
          href="./notifications/new/sms"
          disabled={disabled || !workspace.limits.sms}
        />
        <Separator />
        <Channel
          title="OpsGenie"
          description="Send notifications to OpsGenie."
          href="./notifications/new/opsgenie"
          disabled={disabled || !workspace.limits.opsgenie}
        />
      </div>
    </div>
  );
}

interface ChannelProps {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
}

function Channel({ title, description, href, disabled }: ChannelProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 space-y-1">
        <p className="font-medium text-sm leading-none">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div>
        <Button disabled={disabled} asChild={!disabled}>
          {disabled ? "Create" : <Link href={href}>Create</Link>}
        </Button>
      </div>
    </div>
  );
}
