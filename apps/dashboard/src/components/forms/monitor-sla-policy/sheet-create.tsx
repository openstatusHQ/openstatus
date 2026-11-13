"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetTrigger,
  FormSheetWithDirtyProtection,
} from "@/components/forms/form-sheet";
import { parseSlaTarget } from "@/data/sla-policies.client";
import { useTRPC } from "@/lib/trpc/client";

import { FormMonitorSlaPolicy } from "./form";

/** Create sheet with the mutation attached. `children` is the trigger. */
export function FormSheetMonitorSlaPolicyCreate({
  children,
  monitors,
}: {
  children: React.ReactNode;
  monitors: React.ComponentProps<typeof FormMonitorSlaPolicy>["monitors"];
}) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createMutation = useMutation(
    trpc.monitorSlaPolicy.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitorSlaPolicy.list.queryKey(),
        });
      },
    }),
  );

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>SLA policy</FormSheetTitle>
          <FormSheetDescription>
            The monthly uptime each monitor in the policy has to reach.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormMonitorSlaPolicy
              monitors={monitors}
              onSubmit={async (values) => {
                const target = parseSlaTarget(values.target);
                if (target === null) return;
                await createMutation.mutateAsync({
                  name: values.name,
                  target,
                  strict: values.strict,
                  timeZone: values.timeZone,
                  monitorIds: values.monitorIds,
                });
                setOpen(false);
              }}
              id="monitor-sla-policy-form"
              className="my-4"
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="monitor-sla-policy-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
