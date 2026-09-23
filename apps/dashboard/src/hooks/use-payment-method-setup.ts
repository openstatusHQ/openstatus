import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";

export function usePaymentMethodSetup(workspaceSlug: string | undefined) {
  const trpc = useTRPC();
  const mutation = useMutation(
    trpc.stripeRouter.getPaymentMethodSetupSession.mutationOptions({
      onSuccess: (url) => {
        if (url) window.location.assign(url);
      },
    }),
  );

  return {
    isPending: mutation.isPending,
    start: () => {
      if (!workspaceSlug) return;
      mutation.mutate({
        workspaceSlug,
        successUrl: `${BASE_URL}/settings/billing?setup=true`,
        cancelUrl: `${BASE_URL}/settings/billing`,
      });
    },
  };
}
