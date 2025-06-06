"use client";

import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { workspacePlans } from "@openstatus/db/src/schema";
import type { Workspace, WorkspacePlan } from "@openstatus/db/src/schema";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";
import { api } from "@/trpc/client";

export function ChangePlanButton({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(plan: WorkspacePlan) {
    startTransition(async () => {
      try {
        await api.workspace.changePlan.mutate({ plan });
      } catch (e) {
        if (e instanceof TRPCClientError) {
          toast.error(e.message);
        }
      } finally {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={workspace.plan === "free" ? "default" : "outline"}>
          Change Plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            You are currently on the{" "}
            <span className="font-bold">{workspace.plan}</span> plan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid w-full grid-cols-4 gap-3">
          {workspacePlans.map((plan) => {
            const isActive = plan === workspace.plan;
            return (
              <Button
                key={plan}
                onClick={() => onChange(plan)}
                disabled={isPending || isActive}
                variant="outline"
              >
                {isPending && !isActive ? (
                  <LoadingAnimation variant="inverse" />
                ) : (
                  plan
                )}
              </Button>
            );
          })}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
