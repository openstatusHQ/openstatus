import { Note, NoteButton } from "@/components/common/note";
import { DataTable } from "@/components/data-table/billing/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/lib/trpc/client";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import type { DialogProps } from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";

const PLANS = {
  free: ["starter", "team"],
  starter: ["team"],
  team: [],
} satisfies Record<WorkspacePlan, WorkspacePlan[]>;

export function UpgradeDialog(props: DialogProps) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  if (!workspace) return null;

  const restrictTo = PLANS[workspace.plan];

  return (
    <Dialog {...props}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Workspace</DialogTitle>
          <DialogDescription>
            Upgrade your workspace to support more monitors, status pages,
            regions, and much more.
          </DialogDescription>
        </DialogHeader>
        {restrictTo.length === 0 ? (
          <Note>
            <CalendarClock />
            You&apos;re already on our highest plan. Let&apos;s chat about your
            needs.
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
