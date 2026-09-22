"use client";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { Check, Shield } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardGroup,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";

const RETURN_PATH = "/settings/sso";

function StepBadge({ done, index }: { done: boolean; index: number }) {
  return (
    <Badge variant={done ? "default" : "outline"} className="size-6 p-0">
      {done ? <Check className="size-3" /> : index}
    </Badge>
  );
}

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const { data: sso, isPending } = useQuery(trpc.sso.get.queryOptions());

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.sso.get.queryKey() });

  const enableMutation = useMutation(
    trpc.sso.enable.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
  const disableMutation = useMutation(
    trpc.sso.disable.mutationOptions({
      onSuccess: () => {
        setDisableOpen(false);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const portalLinkMutation = useMutation(
    trpc.sso.portalLink.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!workspace || !user || !members) return null;

  const isOwner =
    members.find((member) => member.user.id === user.id)?.role === "owner";

  if (!isOwner) {
    return (
      <SectionGroup>
        <Section>
          <SectionHeader>
            <SectionTitle>Single Sign-On</SectionTitle>
            <SectionDescription>
              Only workspace owners can manage SSO.
            </SectionDescription>
          </SectionHeader>
        </Section>
      </SectionGroup>
    );
  }

  const allowed = workspace.limits.sso;
  // SSO is a paid add-on on every plan, never bundled — the free plan carries no
  // addons at all, so those workspaces have to move up a plan before buying it.
  const ssoAddon = allPlans[workspace.plan].addons.sso;

  async function openPortal(intent: "sso" | "domain_verification") {
    const result = await portalLinkMutation.mutateAsync({
      intent,
      returnUrl: `${window.location.origin}${RETURN_PATH}`,
    });
    if (result?.link) window.location.href = result.link;
  }

  const configured = Boolean(sso?.configured);
  const hasVerifiedDomain = Boolean(
    sso?.domains.some((entry) => entry.verifiedAt !== null),
  );
  const connectionActive = sso?.connection === "active";

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Single Sign-On</SectionTitle>
          <SectionDescription>
            Let your team sign in through your identity provider with SAML.
            GitHub and Google stay available for everyone.
          </SectionDescription>
        </SectionHeader>

        {!allowed ? (
          <FormCardGroup>
            <FormCard>
              <FormCardHeader>
                <FormCardTitle>Available as an add-on</FormCardTitle>
                <FormCardDescription>
                  {ssoAddon
                    ? "SAML single sign-on is a paid add-on for your plan."
                    : "SAML single sign-on is a paid add-on, available on any paid plan."}
                </FormCardDescription>
              </FormCardHeader>
              <FormCardFooter>
                <FormCardFooterInfo>
                  {ssoAddon
                    ? "Add it to connect Okta, Entra ID, or any SAML provider."
                    : "Upgrade to connect Okta, Entra ID, or any SAML provider."}
                </FormCardFooterInfo>
                <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                  {ssoAddon ? "Add SSO" : "Upgrade"}
                </Button>
              </FormCardFooter>
            </FormCard>
          </FormCardGroup>
        ) : (
          <FormCardGroup>
            <FormCard>
              <FormCardHeader>
                <FormCardTitle>
                  <span className="flex items-center gap-2">
                    <StepBadge done={configured} index={1} />
                    Enable SSO
                  </span>
                </FormCardTitle>
                <FormCardDescription>
                  Creates the organization that holds your connection and
                  domains.
                </FormCardDescription>
              </FormCardHeader>
              <FormCardFooter>
                <FormCardFooterInfo>
                  {configured
                    ? `Organization ${sso?.organizationId}`
                    : "Not enabled yet."}
                </FormCardFooterInfo>
                {configured ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDisableOpen(true)}
                  >
                    Disable SSO
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={enableMutation.isPending || isPending}
                    onClick={() => enableMutation.mutate(undefined)}
                  >
                    Enable SSO
                  </Button>
                )}
              </FormCardFooter>
            </FormCard>

            <FormCard>
              <FormCardHeader>
                <FormCardTitle>
                  <span className="flex items-center gap-2">
                    <StepBadge done={hasVerifiedDomain} index={2} />
                    Verify your domain
                  </span>
                </FormCardTitle>
                <FormCardDescription>
                  Users can only sign in with SSO from a domain you have
                  verified.
                </FormCardDescription>
              </FormCardHeader>
              <FormCardContent>
                {sso?.domains.length ? (
                  <ul className="flex flex-col gap-2">
                    {sso.domains.map((entry) => (
                      <li
                        key={entry.domain}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-commit-mono">{entry.domain}</span>
                        <Badge
                          variant={entry.verifiedAt ? "default" : "outline"}
                        >
                          {entry.verifiedAt ? "Verified" : "Pending"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No domains yet. Until one is verified, SSO sign-in will be
                    refused.
                  </p>
                )}
              </FormCardContent>
              <FormCardFooter>
                <FormCardFooterInfo>
                  Domain ownership is proven with a DNS record.
                </FormCardFooterInfo>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!configured || portalLinkMutation.isPending}
                  onClick={() => openPortal("domain_verification")}
                >
                  Verify a domain
                </Button>
              </FormCardFooter>
            </FormCard>

            <FormCard>
              <FormCardHeader>
                <FormCardTitle>
                  <span className="flex items-center gap-2">
                    <StepBadge done={connectionActive} index={3} />
                    Connect your identity provider
                  </span>
                </FormCardTitle>
                <FormCardDescription>
                  Configure SAML in Okta, Entra ID, or any supported provider.
                </FormCardDescription>
              </FormCardHeader>
              <FormCardFooter>
                <FormCardFooterInfo>
                  {sso?.ready ? (
                    <span className="flex items-center gap-1">
                      <Shield className="size-3" />
                      Ready — your team can sign in with SSO.
                    </span>
                  ) : (
                    `Connection: ${sso?.connection ?? "none"}`
                  )}
                </FormCardFooterInfo>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!configured || portalLinkMutation.isPending}
                  onClick={() => openPortal("sso")}
                >
                  Configure in WorkOS
                </Button>
              </FormCardFooter>
            </FormCard>
          </FormCardGroup>
        )}
      </Section>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        limit="sso"
      />

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable SSO?</DialogTitle>
            <DialogDescription>
              Your team will no longer be able to sign in through your identity
              provider. Nobody loses access to the workspace — existing members
              keep signing in with GitHub or Google, and your provider
              configuration is kept so you can re-enable it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disableMutation.isPending}
              onClick={() => disableMutation.mutate(undefined)}
            >
              Disable SSO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionGroup>
  );
}
