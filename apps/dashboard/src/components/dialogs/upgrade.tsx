import { Note, NoteButton } from "@/components/common/note";
import { DataTable } from "@/components/data-table/billing/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/lib/trpc/client";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Addons, Limits } from "@openstatus/db/src/schema/plan/schema";
import { getPlansForLimit } from "@openstatus/db/src/schema/plan/utils";
import type { DialogProps } from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { BillingAddons } from "../content/billing-addons";

const PLANS = {
  free: ["starter", "team"],
  starter: ["team"],
  team: [],
} satisfies Record<WorkspacePlan, WorkspacePlan[]>;

export function UpgradeDialog(
  props: DialogProps & {
    limit?: keyof Limits;
    restrictTo?: WorkspacePlan[];
  },
) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  if (!workspace) return null;

  const planAddons = allPlans[workspace.plan].addons;

  const getRestrictTo = () => {
    if (props.restrictTo) return props.restrictTo;
    if (props.limit) return getPlansForLimit(workspace.plan, props.limit);
    return PLANS[workspace.plan];
  };

  const restrictTo = getRestrictTo();

  const addon =
    props.limit && Object.prototype.hasOwnProperty.call(planAddons, props.limit)
      ? (props.limit as keyof Addons)
      : null;

  return (
    <Dialog {...props}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade Workspace</DialogTitle>
          <DialogDescription>
            Upgrade your workspace to support more monitors, status pages,
            regions, and much more.
          </DialogDescription>
        </DialogHeader>
        {addon && planAddons[addon] ? (
          <>
            <BillingAddons
              label={planAddons[addon].title}
              description={planAddons[addon].description}
              addon={addon}
              workspace={workspace}
            />
            <Separator />
          </>
        ) : null}
        {restrictTo.length === 0 ? (
          <Note>
            <CalendarClock />
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
        ) : (
          <DataTable restrictTo={restrictTo} />
        )}
      </DialogContent>
    </Dialog>
  );
}
