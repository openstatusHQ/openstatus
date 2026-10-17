import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  FormAlertDialogAction,
  FormAlertDialogCancel,
  FormAlertDialogConfirmInput,
  FormAlertDialogContent,
  FormAlertDialogDescription,
  FormAlertDialogFooter,
  FormAlertDialogHeader,
  FormAlertDialogRoot,
  FormAlertDialogTitle,
} from "@/components/forms/form-alert-dialog";
import { useTRPC } from "@/lib/trpc/client";

export function TransferOwnershipDialog({
  member,
  open,
  onOpenChange,
}: {
  member: { id: number; name: string | null; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const transferOwnershipMutation = useMutation(
    trpc.member.transferOwnership.mutationOptions({
      onSuccess: () => {
        // The SSO and account pages derive `isOwner` from `member.list`.
        queryClient.invalidateQueries({
          queryKey: trpc.member.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.get.queryKey(),
        });
      },
    }),
  );

  // The router syncs the Stripe customer email whenever one is linked, paid
  // plan or not.
  const hasStripeCustomer = !!workspace?.stripeId;
  const workspaceName = workspace?.name || workspace?.slug || "this workspace";

  return (
    <FormAlertDialogRoot
      open={open}
      onOpenChange={onOpenChange}
      confirmationValue={member.email}
      toast={{
        loading: "Transferring ownership...",
        success: "Ownership transferred",
        error: "Failed to transfer ownership",
      }}
      submitAction={async () => {
        await transferOwnershipMutation.mutateAsync({ id: member.id });
      }}
    >
      <FormAlertDialogContent>
        <FormAlertDialogHeader>
          <FormAlertDialogTitle>
            Transfer ownership to {member.name || member.email}?
          </FormAlertDialogTitle>
          <FormAlertDialogDescription>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                {member.email} becomes the owner of {workspaceName}.
              </li>
              <li>
                You become a member. You lose access to SSO settings and member
                management, and you can&apos;t undo this yourself.
              </li>
              {hasStripeCustomer ? (
                <li>
                  Billing emails from openstatus go to the new owner. If the
                  billing email on your subscription is your address, it moves
                  to them too. A different address, such as a finance inbox,
                  stays as it is.
                </li>
              ) : null}
            </ul>
          </FormAlertDialogDescription>
        </FormAlertDialogHeader>
        <FormAlertDialogConfirmInput />
        <FormAlertDialogFooter>
          <FormAlertDialogCancel />
          <FormAlertDialogAction pendingLabel="Transferring...">
            Transfer
          </FormAlertDialogAction>
        </FormAlertDialogFooter>
      </FormAlertDialogContent>
    </FormAlertDialogRoot>
  );
}
