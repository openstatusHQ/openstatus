"use client";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetPrivateLocation } from "@/components/forms/private-location/sheet";
import { NavFeedback } from "@/components/nav/nav-feedback";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function NavActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const createPrivateLocationMutation = useMutation(
    trpc.privateLocation.new.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.privateLocation.list.queryKey(),
        });
      },
    }),
  );

  if (!workspace || !monitors) return null;

  const limitReached = !workspace.limits["private-locations"];

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {limitReached ? (
        <Button
          size="sm"
          data-disabled={limitReached}
          className="data-[disabled=true]:opacity-50"
          onClick={() => setOpenDialog(true)}
        >
          Create Private Location
        </Button>
      ) : (
        <FormSheetPrivateLocation
          monitors={monitors}
          onSubmit={async (values) => {
            await createPrivateLocationMutation.mutateAsync({
              name: values.name,
              monitors: values.monitors,
            });
          }}
        >
          <Button size="sm">Create Private Location</Button>
        </FormSheetPrivateLocation>
      )}
      <UpgradeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </div>
  );
}
