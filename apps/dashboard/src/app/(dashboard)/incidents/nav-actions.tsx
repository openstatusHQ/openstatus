"use client";

import { Copy } from "@openstatus/icons";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { NavFeedback } from "@/components/nav/nav-feedback";

export function NavActions() {
  // The layout also wraps /incidents/[id]; only the detail page has a menu.
  const { id } = useParams<{ id?: string }>();
  const { copy } = useCopyToClipboard();

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
                const copied = await copy(id, {
                  withToast: "Incident ID copied to clipboard",
                });
                if (!copied) toast.error("Failed to copy incident ID");
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
