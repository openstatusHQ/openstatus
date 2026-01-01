"use client";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormEmail, type FormValues } from "@/components/forms/form-email";
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import { signInWithResendAction } from "../actions";

export function SectionMagicLink() {
  const { domain } = useParams<{ domain: string }>();
  const [state, setState] = useState<"idle" | "pending" | "success">("idle");

  async function submitAction(values: FormValues) {
    // NOTE: we can improve a bit if we use pathname instead of subdomain/hostname
    // like http://localhost:3000/hello, the redirectTo should be http://localhost:3000/hello
    // this only affects local development if not using chrome and subdomain
    const redirectTo =
      process.env.NODE_ENV === "development"
        ? `http://${window.location.hostname}:${window.location.port}`
        : `https://${window.location.hostname}`;

    const formData = new FormData();
    formData.append("redirectTo", redirectTo);
    formData.append("email", values.email);
    formData.append("domain", domain);

    // we need this because submitAction is called  in a startTransition and we need to update the state immediately
    flushSync(() => setState("pending"));

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await signInWithResendAction(formData);
      setState("success");
    } catch (error) {
      setState("idle");
      throw error;
    }
  }

  return (
    <Section className="m-auto w-full max-w-lg rounded-lg border bg-card p-4">
      <SectionHeader>
        <SectionTitle>Authenticate</SectionTitle>
        <SectionDescription>
          Enter your email to receive a magic link for accessing the status
          page. Note: Only emails from approved domains are accepted.
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
            {state === "pending" ? "Submitting..." : "Submit"}
          </Button>
        </div>
      ) : (
        <SuccessState />
      )}
    </Section>
  );
}

function SuccessState() {
  return (
    <EmptyStateContainer>
      <Inbox className="size-4 shrink-0" />
      <EmptyStateTitle>Check your inbox!</EmptyStateTitle>
      <EmptyStateDescription>
        Access the status page by clicking the link in the email.
      </EmptyStateDescription>
    </EmptyStateContainer>
  );
}
