"use client";

import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankLink,
  StatusBlankTitle,
} from "@/components/status-page/status-blank";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function VerifyPage() {
  const t = useExtracted();
  const trpc = useTRPC();
  const { token, domain } = useParams<{ token: string; domain: string }>();
  const verifyEmailMutation = useMutation(
    trpc.statusPage.verifyEmail.mutationOptions({}),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    verifyEmailMutation.mutate({ slug: domain, token });
  }, [domain, token]);

  const title = verifyEmailMutation.isSuccess
    ? t("All set to receive updates to {email}!", {
        email: verifyEmailMutation.data?.email ?? "",
      })
    : verifyEmailMutation.isError
      ? verifyEmailMutation.error?.message || t("Something went wrong")
      : t("Hang tight - we're confirming your subscription");

  return (
    <StatusBlankContainer>
      <StatusBlankContent>
        <StatusBlankTitle
          className={cn({
            "text-destructive": verifyEmailMutation.isError,
            "text-success": verifyEmailMutation.isSuccess,
          })}
        >
          {title}
        </StatusBlankTitle>
        <div className="flex justify-center gap-2">
          <StatusBlankLink
            href="/"
            disabled={
              verifyEmailMutation.isPending || !verifyEmailMutation.data
            }
          >
            {t("Go back")}
          </StatusBlankLink>
          {verifyEmailMutation.isSuccess && (
            <StatusBlankLink
              href={`/manage/${token}`}
              disabled={
                verifyEmailMutation.isPending || !verifyEmailMutation.data
              }
            >
              {t("Manage")}
            </StatusBlankLink>
          )}
        </div>
      </StatusBlankContent>
    </StatusBlankContainer>
  );
}
