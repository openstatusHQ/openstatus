"use client";

import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormPassword } from "@/components/forms/form-password";
import { Button } from "@/components/ui/button";
import { useCookieState } from "@/hooks/use-cookie-state";
import { createProtectedCookieKey } from "@/lib/protected";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export function SectionPassword() {
  const { domain } = useParams<{ domain: string }>();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const [_, setPassword] = useCookieState(createProtectedCookieKey(domain));
  const router = useRouter();
  const verifyPasswordMutation = useMutation(
    trpc.statusPage.verifyPassword.mutationOptions({}),
  );

  return (
    <Section className="m-auto w-full max-w-lg rounded-lg border bg-card p-4">
      <SectionHeader>
        <SectionTitle>Protected Page</SectionTitle>
        <SectionDescription>
          Enter the password to access the status page.
        </SectionDescription>
      </SectionHeader>
      <div className="flex flex-col gap-2">
        <FormPassword
          id="password-form"
          onSubmit={async (values) => {
            const result = await verifyPasswordMutation.mutateAsync({
              slug: domain,
              password: values.password,
            });
            if (result) {
              setPassword(values.password);
              const redirect = searchParams.get("redirect");
              router.push(redirect ?? "/");
            }
          }}
        />
        <Button type="submit" form="password-form">
          Submit
        </Button>
      </div>
    </Section>
  );
}
