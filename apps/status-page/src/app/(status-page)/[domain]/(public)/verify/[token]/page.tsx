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
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function VerifyPage() {
  const trpc = useTRPC();
  const { token, domain } = useParams<{ token: string; domain: string }>();
  const verifyEmailMutation = useMutation(
    trpc.pageSubscription.verify.mutationOptions({}),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    verifyEmailMutation.mutate({ token, domain });
  }, [token, domain]);

  const title = verifyEmailMutation.isSuccess
    ? `All set to receive updates to ${verifyEmailMutation.data?.subscription.email}!`
    : verifyEmailMutation.isError
      ? verifyEmailMutation.error?.message || "Something went wrong"
      : "Hang tight - we're confirming your subscription";

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
        <StatusBlankLink
          href="../"
          disabled={verifyEmailMutation.isPending || !verifyEmailMutation.data}
        >
          Go back
        </StatusBlankLink>
      </StatusBlankContent>
    </StatusBlankContainer>
  );
}
