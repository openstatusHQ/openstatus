"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { NavFeedback } from "@/components/nav/nav-feedack";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getActions } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: parseInt(id) })
  );

  const deleteStatusPageMutation = useMutation(
    trpc.page.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
        if (pathname.includes(`/status-pages/${id}`)) {
          router.push("/status-pages");
        }
      },
    })
  );

  const actions = getActions({
    edit: () => router.push(`/status-pages/${id}/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Status Page ID copied to clipboard");
    },
  });

  if (!statusPage) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="group h-7 w-7" asChild>
              <a
                href={`https://${statusPage.customDomain ?? `${statusPage.slug}.openstatus.dev`}`}
                target="_blank"
              >
                <Globe className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View Page</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Status Page",
          confirmationValue: "delete status page",
          submitAction: async () => {
            await deleteStatusPageMutation.mutateAsync({
              id: parseInt(id),
            });
          },
        }}
      />
    </div>
  );
}
