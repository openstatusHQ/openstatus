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
import type { DialogProps } from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

/** Asked after an upgrade or trial start; stored as `upgrade-intent` feedback. */
export function UpgradeIntentDialog(props: DialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const [message, setMessage] = useState("");
  const feedbackMutation = useMutation(
    trpc.feedback.submit.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.feedback.hasSubmitted.queryKey({
            source: "upgrade-intent",
          }),
        });
        toast.success("Thanks for sharing");
        props.onOpenChange?.(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Dialog {...props}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What are you using openstatus for?</DialogTitle>
          <DialogDescription>
            A sentence or two helps us tailor openstatus to you.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id} className="sr-only">
            What are you using openstatus for?
          </Label>
          <Textarea
            id={id}
            className="min-h-28"
            value={message}
            placeholder="Incident response with Slack alerts for on-call, a public status page for customers, uptime checks for our API from multiple regions, uptime reports for compliance, ..."
            onChange={(e) => setMessage(e.target.value)}
            disabled={feedbackMutation.isPending}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => props.onOpenChange?.(false)}
            disabled={feedbackMutation.isPending}
          >
            Skip
          </Button>
          <Button
            onClick={() =>
              feedbackMutation.mutate({
                source: "upgrade-intent",
                message,
                path: window.location.pathname,
              })
            }
            disabled={feedbackMutation.isPending || !message.trim()}
          >
            {feedbackMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
