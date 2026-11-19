import { TRIAL_DAYS } from "@openstatus/api/src/router/stripe/trial-config";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Addons, Limits } from "@openstatus/db/src/schema/plan/schema";
import { Schedule } from "@openstatus/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import type { DialogProps } from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import { Note, NoteButton } from "@/components/common/note";
import { BillingAddons } from "@/components/content/billing-addons";
import { DataTable } from "@/components/data-table/billing/data-table";
import { config as featureGroups } from "@/data/plans";
import { useTRPC } from "@/lib/trpc/client";

const PLAN_ORDER: WorkspacePlan[] = ["free", "starter", "team", "scale"];

const UNITS: Partial<Record<keyof Limits, [string, string]>> = {
  monitors: ["monitor", "monitors"],
  "status-pages": ["status page", "status pages"],
  "page-components": ["page component", "page components"],
  "notification-channels": ["notification channel", "notification channels"],
};

function getTitle(limit: keyof Limits | undefined, plan: WorkspacePlan) {
  if (!limit) return null;
  const value = allPlans[plan].limits[limit];
  const units = UNITS[limit];
  if (typeof value === "number" && units) {
    return `${allPlans[plan].title} includes ${value} ${units[value === 1 ? 0 : 1]}`;
  }
  const label = Object.values(featureGroups)
    .flatMap(({ features }) => features)
    .find((feature) => feature.value === limit)?.label;
  if (value === false && label) {
    return `${label} is not part of ${allPlans[plan].title}`;
  }
  return null;
}

export function UpgradeDialog(
  props: DialogProps & {
    limit?: keyof Limits;
  },
) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  if (!workspace) return null;

  const planAddons = allPlans[workspace.plan].addons;
  // The current plan stays in as the column to compare against.
  const plans = PLAN_ORDER.slice(PLAN_ORDER.indexOf(workspace.plan));
  const canUpgrade = plans.length > 1;
  const canTrial =
    workspace?.trial.eligible === true && plans.includes("starter");
  const title = getTitle(props.limit, workspace.plan);

  const addon =
    props.limit && Object.prototype.hasOwnProperty.call(planAddons, props.limit)
      ? (props.limit as keyof Addons)
      : null;

  return (
    <Dialog {...props}>
      <DialogContent
        tabIndex={-1}
        // Focus the dialog, not the first tab: no stray ring on open.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-4xl"
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>
            {title ??
              (canTrial
                ? `Try Starter free for ${TRIAL_DAYS} days`
                : "Upgrade Workspace")}
          </DialogTitle>
          <DialogDescription>
            {canTrial
              ? `Starter is free for ${TRIAL_DAYS} days, no credit card needed. `
              : "Upgrade your workspace to support more monitors, status pages, regions, and much more. "}
            Get an overview within your{" "}
            <Link
              onClick={() => props.onOpenChange?.(false)}
              href={
                props.limit
                  ? `/settings/billing?highlight=${props.limit}#plans`
                  : "/settings/billing#plans"
              }
            >
              billing settings
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        {addon && planAddons[addon] ? (
          <div className="border-t px-6 py-4">
            <BillingAddons
              label={planAddons[addon].title}
              description={planAddons[addon].description}
              addon={addon}
              workspace={workspace}
            />
          </div>
        ) : null}
        {canUpgrade ? (
          <DataTable
            restrictTo={plans}
            surface="upgrade_dialog"
            highlight={props.limit}
            collapsed
            className="min-h-0 flex-1"
          />
        ) : (
          <div className="px-6 pb-6">
            <Note>
              <Schedule />
              Please contact us to upgrade your plan.
              <NoteButton variant="outline" asChild>
                <a
                  href="https://openstatus.dev/cal"
                  target="_blank"
                  rel="noreferrer"
                  className="text-nowrap"
                >
                  Book a call
                </a>
              </NoteButton>
            </Note>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
