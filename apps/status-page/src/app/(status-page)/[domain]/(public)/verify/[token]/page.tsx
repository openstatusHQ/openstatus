"use client";

import { ButtonBack } from "@/components/button/button-back";
import {
  Status,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function VerifyPage() {
  const trpc = useTRPC();
  const { token, domain } = useParams<{ token: string; domain: string }>();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  const verifyEmailMutation = useMutation(
    trpc.statusPage.verifyEmail.mutationOptions({}),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    verifyEmailMutation.mutate({ slug: domain, token });
  }, [domain, token]);

  if (!page) return null;

  return (
    <Status className="my-auto text-center">
      <StatusHeader className="space-y-2 font-mono">
        {verifyEmailMutation.isSuccess ? (
          <StatusTitle>
            All set to receive updates from {page.title} to{" "}
            {verifyEmailMutation.data?.email}
          </StatusTitle>
        ) : verifyEmailMutation.isError ? (
          <StatusTitle
            className={cn(
              verifyEmailMutation.error?.data?.code === "NOT_FOUND"
                ? "text-destructive"
                : "",
            )}
          >
            {verifyEmailMutation.error?.message}
          </StatusTitle>
        ) : (
          <StatusTitle>
            Hang tight - we're confirming your subscription
          </StatusTitle>
        )}
        <ButtonBack
          href="../"
          className={cn(
            verifyEmailMutation.isSuccess || verifyEmailMutation.isError
              ? "visible"
              : "invisible",
          )}
        />
      </StatusHeader>
    </Status>
  );
}
