"use client";

import { Copy } from "@openstatus/icons";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { NavFeedback } from "@/components/nav/nav-feedback";

export function NavActions() {
  // The layout also wraps /incidents/[id]; only the detail page has a menu.
  const { id } = useParams<{ id?: string }>();

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {id ? (
        <QuickActions
          actions={[
            {
              id: "copy-id",
              label: "Copy ID",
              icon: Copy,
              variant: "default",
              onClick: async () => {
                await navigator.clipboard.writeText(id);
                toast.success("Incident ID copied to clipboard");
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
