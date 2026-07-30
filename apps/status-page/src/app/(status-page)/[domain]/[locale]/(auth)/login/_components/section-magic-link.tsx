"use client";

import { Inbox } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useExtracted } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "../../../../../../../components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "../../../../../../../components/content/section";
import {
  FormEmail,
  type FormValues,
} from "../../../../../../../components/forms/form-email";
import { buildPageBaseUrl } from "../../../../../../../lib/page-slug";
import { generateServerActionPromise } from "../../../../../../../lib/server-actions";
import { signInWithResendAction } from "../actions";

export function SectionMagicLink() {
  const t = useExtracted();
  const { domain } = useParams<{ domain: string }>();
  const [state, setState] = useState<"idle" | "pending" | "success">("idle");

  async function submitAction(values: FormValues) {
    // The magic-link callback hits /api/auth/*, which the proxy never tags with
    // a slug — this URL is where it recovers the page from.
    const redirectTo = buildPageBaseUrl({
      origin: window.location.origin,
      slug: domain,
    });

    const formData = new FormData();
    formData.append("redirectTo", redirectTo);
    formData.append("email", values.email);
    formData.append("domain", domain);

    // we need this because submitAction is called  in a startTransition and we need to update the state immediately
    flushSync(() => setState("pending"));

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await generateServerActionPromise(signInWithResendAction(formData));
      setState("success");
    } catch (error) {
      setState("idle");
      throw error;
    }
  }

  return (
    <Section className="bg-card m-auto w-full max-w-lg rounded-lg border p-4">
      <SectionHeader>
        <SectionTitle>{t("Authenticate")}</SectionTitle>
        <SectionDescription>
          {t(
            "Enter your email to receive a magic link for accessing the status page. Note: Only emails from approved domains are accepted.",
          )}
        </SectionDescription>
      </SectionHeader>
      {state !== "success" ? (
        <div className="flex flex-col gap-2">
          <FormEmail id="email-form" onSubmit={submitAction} />
          <Button
            type="submit"
            form="email-form"
            disabled={state === "pending"}
          >
            {state === "pending" ? t("Submitting...") : t("Submit")}
          </Button>
        </div>
      ) : (
        <SuccessState />
      )}
    </Section>
  );
}

function SuccessState() {
  const t = useExtracted();
  return (
    <EmptyStateContainer>
      <Inbox className="size-4 shrink-0" />
      <EmptyStateTitle>{t("Check your inbox!")}</EmptyStateTitle>
      <EmptyStateDescription>
        {t("Access the status page by clicking the link in the email.")}
      </EmptyStateDescription>
    </EmptyStateContainer>
  );
}
