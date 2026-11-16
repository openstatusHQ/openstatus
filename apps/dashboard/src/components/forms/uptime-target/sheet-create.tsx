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
import { parseUptimeTarget } from "@/data/reports.client";
import { useTRPC } from "@/lib/trpc/client";

import { FormUptimeTarget } from "./form";

/** Create sheet with the mutation attached. `children` is the trigger. */
export function FormSheetUptimeTargetCreate({
  children,
  monitors,
}: {
  children: React.ReactNode;
  monitors: React.ComponentProps<typeof FormUptimeTarget>["monitors"];
}) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createMutation = useMutation(
    trpc.uptimeTarget.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.uptimeTarget.pathKey(),
        });
      },
    }),
  );

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>Uptime target</FormSheetTitle>
          <FormSheetDescription>
            The monthly uptime each monitor in the uptime target has to reach.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormUptimeTarget
              monitors={monitors}
              onSubmit={async (values) => {
                const target = parseUptimeTarget(values.target);
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
              id="uptime-target-form"
              className="my-4"
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="uptime-target-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
