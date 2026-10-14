"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { Label } from "@openstatus/ui/components/ui/label";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import type { DialogProps } from "@radix-ui/react-dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

export const TRIAL_DAYS = 14;

// Stripe caps a metadata value at 500 characters.
const INTENT_MAX = 500;

type TrialSurface = "billing" | "plan_table";

export function TrialIntentField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        What do you want to test?{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        maxLength={INTENT_MAX}
        placeholder="Status page for our customers, Slack alerts, ..."
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

export function StartTrialDialog(
  props: DialogProps & { surface?: TrialSurface },
) {
  const { surface = "plan_table", ...dialogProps } = props;
  const trpc = useTRPC();
  const [currency] = useCookieState("x-currency", "USD");
  const [intent, setIntent] = useState("");
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const checkoutSessionMutation = useMutation(
    trpc.stripeRouter.getCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        if (data?.type === "checkout" && data.session.url) {
          window.location.assign(data.session.url);
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const isPending = checkoutSessionMutation.isPending;

  return (
    <Dialog {...dialogProps}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start your {TRIAL_DAYS}-day Starter trial</DialogTitle>
          <DialogDescription>
            No card needed. Stripe shows you the plan and the price that applies
            after the trial.
          </DialogDescription>
        </DialogHeader>
        <TrialIntentField
          value={intent}
          onChange={setIntent}
          disabled={isPending}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => dialogProps.onOpenChange?.(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!workspace) return;
              checkoutSessionMutation.mutate({
                trial: true,
                plan: "starter",
                interval: "monthly",
                surface,
                intent: intent.trim() || undefined,
                currency: currency || "USD",
                workspaceSlug: workspace.slug,
                successUrl: `${window.location.origin}/settings/billing?trial=true`,
                cancelUrl: `${window.location.origin}/settings/billing`,
              });
            }}
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Continue to Stripe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
