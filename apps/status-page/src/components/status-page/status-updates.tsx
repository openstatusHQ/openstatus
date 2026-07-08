"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Inbox } from "@openstatus/icons";
import {
  StatusUpdates as BlockStatusUpdates,
  StatusUpdatesContent,
  StatusUpdatesJson,
  StatusUpdatesRss,
  StatusUpdatesSection,
  StatusUpdatesSlack,
  StatusUpdatesSsh,
  StatusUpdatesTrigger,
} from "@openstatus/ui/components/blocks/status-updates";
import { Button } from "@openstatus/ui/components/ui/button";
import { Separator } from "@openstatus/ui/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { cn } from "@openstatus/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";

import { getBaseUrl } from "../../lib/base-url";
import { createProtectedCookieKey } from "../../lib/protected";
import {
  FormSubscribeEmail,
  type FormValues,
} from "../forms/form-subscribe-email";

export type StatusUpdateType = "email" | "rss" | "ssh" | "json" | "slack";

type Page = NonNullable<RouterOutputs["statusPage"]["get"]>;

function getUpdateLink(
  type: "rss" | "json" | "atom",
  page?: Page | null,
  password?: string,
) {
  const baseUrl = getBaseUrl({
    slug: page?.slug,
    customDomain: page?.customDomain,
  });

  return `${baseUrl}/feed/${type}${
    page?.accessType === "password" && password
      ? `?pw=${encodeURIComponent(password)}`
      : ""
  }`;
}

interface StatusUpdatesProps extends React.ComponentProps<typeof Button> {
  types?: StatusUpdateType[];
  page?: Page | null;
  onSubscribe?: (values: FormValues) => Promise<void> | void;
}

export function StatusUpdates({
  className,
  types = ["rss", "ssh", "json", "slack"],
  page,
  onSubscribe,
  ...props
}: StatusUpdatesProps) {
  const t = useExtracted();
  const [success, setSuccess] = useState(false);
  const params = useParams();
  const domain = typeof params.domain === "string" ? params.domain : "";
  // The password lives in the cookie this browser set at login — not in the
  // page payload, which intentionally omits it.
  const [password] = useCookieState(createProtectedCookieKey(domain));

  if (types.length === 0) return null;

  const rssUrl = getUpdateLink("rss", page, password);
  const atomUrl = getUpdateLink("atom", page, password);
  const jsonUrl = getUpdateLink("json", page, password);
  const sshCommand = `ssh ${page?.slug}@ssh.openstatus.dev`;

  return (
    <BlockStatusUpdates>
      <StatusUpdatesTrigger className={cn(className)} {...props} />
      <StatusUpdatesContent>
        <Tabs defaultValue={types[0]}>
          <TabsList className="w-full rounded-none border-b">
            {types.includes("email") ? (
              <TabsTrigger value="email">{t("Email")}</TabsTrigger>
            ) : null}
            {types.includes("slack") ? (
              <TabsTrigger value="slack">{t("Slack")}</TabsTrigger>
            ) : null}
            {types.includes("rss") ? (
              <TabsTrigger value="rss">{t("RSS")}</TabsTrigger>
            ) : null}
            {types.includes("json") ? (
              <TabsTrigger value="json">{t("JSON")}</TabsTrigger>
            ) : null}
            {types.includes("ssh") ? (
              <TabsTrigger value="ssh">{t("SSH")}</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="email" className="flex flex-col gap-2">
            {success ? (
              <SuccessMessage />
            ) : (
              <>
                <StatusUpdatesSection
                  description={t(
                    "Get email notifications whenever a report has been created or resolved",
                  )}
                  className="py-0 pt-2"
                >
                  <FormSubscribeEmail
                    id="email-form"
                    page={page}
                    onSubmit={async (values) => {
                      await onSubscribe?.(values);
                      setSuccess(true);
                    }}
                  />
                </StatusUpdatesSection>
                <Separator />
                <div className="px-2 pb-2">
                  <Button className="w-full" type="submit" form="email-form">
                    {t("Subscribe")}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="rss">
            <StatusUpdatesRss rssUrl={rssUrl} atomUrl={atomUrl} />
          </TabsContent>
          <TabsContent value="json">
            <StatusUpdatesJson url={jsonUrl} />
          </TabsContent>
          <TabsContent value="ssh">
            <StatusUpdatesSsh command={sshCommand} />
          </TabsContent>
          <TabsContent value="slack">
            <StatusUpdatesSlack rssUrl={rssUrl} />
          </TabsContent>
        </Tabs>
      </StatusUpdatesContent>
    </BlockStatusUpdates>
  );
}

function SuccessMessage() {
  const t = useExtracted();
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-3">
      <Inbox className="size-4 shrink-0" />
      <p className="text-center font-medium">{t("Check your inbox!")}</p>
      <p className="text-muted-foreground text-center text-sm">
        {t("Validate your email to receive updates and you are all set.")}
      </p>
    </div>
  );
}
