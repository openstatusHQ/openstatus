"use client";

import { Link } from "@/components/common/link";
import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormAlertDialog } from "@/components/forms/form-alert-dialog";
import {
  FormCardDescription,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";
import {
  FormCard,
  FormCardContent,
  FormCardFooter,
} from "@/components/forms/form-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

export default function Page() {
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());

  const deleteAccountMutation = useMutation(
    trpc.user.deleteAccount.mutationOptions(),
  );

  if (!user || !workspace || !members) return null;

  const isOwner = members.find((m) => m.user.id === user.id)?.role === "owner";
  const hasPaidPlan = !!workspace.plan && workspace.plan !== "free";
  const isDeleteDisabled = isOwner && hasPaidPlan;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Account</SectionTitle>
        </SectionHeader>
        <FormCard>
          <FormCardUpgrade />
          <FormCardHeader>
            <FormCardTitle>Personal Information</FormCardTitle>
            <FormCardDescription>
              Manage your personal information.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <form className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input defaultValue={user?.name ?? undefined} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input defaultValue={user?.email ?? undefined} />
              </div>
            </form>
          </FormCardContent>
          <FormCardFooter className="[&>:last-child]:ml-0">
            <FormCardFooterInfo>
              Please contact us if you want to change your email or name.
            </FormCardFooterInfo>
          </FormCardFooter>
        </FormCard>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Appearance</FormCardTitle>
            <FormCardDescription>
              Choose your preferred theme.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="pb-4">
            <ThemeToggle />
          </FormCardContent>
        </FormCard>
        <FormCard variant="destructive">
          <FormCardHeader>
            <FormCardTitle>Delete Account</FormCardTitle>
            <FormCardDescription>
              This will permanently delete your account and remove you from all
              workspaces. This action cannot be undone.
            </FormCardDescription>
          </FormCardHeader>
          {isDeleteDisabled ? (
            <FormCardContent>
              <p className="text-destructive text-sm">
                You must cancel your subscription before deleting your account.
                Go to{" "}
                <a
                  href="/settings/billing"
                  className="font-medium underline underline-offset-4"
                >
                  Billing
                </a>{" "}
                to manage your subscription.
              </p>
            </FormCardContent>
          ) : null}
          <FormCardFooter variant="destructive">
            <FormCardFooterInfo>
              Need help? Contact us at{" "}
              <Link href="mailto:ping@openstatus.dev">ping@openstatus.dev</Link>
              .
            </FormCardFooterInfo>
            <FormAlertDialog
              confirmationValue={user.email || user.name || "delete-account"}
              submitAction={async () => {
                await deleteAccountMutation.mutateAsync();
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleteDisabled}
              >
                Delete
              </Button>
            </FormAlertDialog>
          </FormCardFooter>
        </FormCard>
      </Section>
    </SectionGroup>
  );
}
