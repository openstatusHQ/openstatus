"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FormSheetPrivateLocation } from "@/components/forms/private-location/sheet";
import { useTRPC } from "@/lib/trpc/client";

/** Create sheet with the mutation attached. `children` is the trigger. */
export function FormSheetPrivateLocationCreate({
  children,
  monitors,
}: {
  children: React.ReactNode;
  monitors: React.ComponentProps<typeof FormSheetPrivateLocation>["monitors"];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createPrivateLocationMutation = useMutation(
    trpc.privateLocation.new.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.privateLocation.list.queryKey(),
        });
      },
    }),
  );

  return (
    <FormSheetPrivateLocation
      monitors={monitors}
      onSubmit={async (values) => {
        await createPrivateLocationMutation.mutateAsync({
          name: values.name,
          monitors: values.monitors,
          token: values.token,
          metadata: Object.fromEntries(
            values.metadata.map((m) => [m.key, m.value]),
          ),
        });
      }}
    >
      {children}
    </FormSheetPrivateLocation>
  );
}
