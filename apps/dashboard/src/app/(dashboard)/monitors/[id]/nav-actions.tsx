"use client";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getActions } from "@/data/monitors.client";
import { Zap } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { isTRPCClientError } from "@trpc/client";

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const [openDialog, setOpenDialog] = useState(false);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();

  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );

  const deleteMonitorMutation = useMutation(
    trpc.monitor.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        if (pathname.includes(`/monitors/${id}`)) {
          router.push("/monitors");
        }
      },
    })
  );

  const cloneMonitorMutation = useMutation(
    trpc.monitor.clone.mutationOptions({
      onSuccess: (newMonitor) => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        router.push(`/monitors/${newMonitor.id}`);
      },
    })
  );

  const testHttpMutation = useMutation(trpc.checker.testHttp.mutationOptions());
  const testTcpMutation = useMutation(trpc.checker.testTcp.mutationOptions());

  const actions = getActions({
    edit: () => router.push(`/monitors/${id}/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Monitor ID copied to clipboard");
    },
    // export: () => setOpenDialog(true),
    clone: () => {
      const promise = cloneMonitorMutation.mutateAsync({ id: parseInt(id) });
      toast.promise(promise, {
        loading: "Cloning monitor...",
        success: "Monitor cloned",
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "Failed to clone monitor";
        },
      });
    },
  });

  async function testAction() {
    if (monitor?.jobType === "http") {
      const promise = testHttpMutation.mutateAsync({
        url: monitor.url,
        body: monitor.body,
        method: monitor.method,
        headers: monitor.headers,
      });

      toast.promise(promise, {
        loading: "Testing HTTP request...",
        success: "HTTP test completed successfully",
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "HTTP test failed";
        },
      });
    } else if (monitor?.jobType === "tcp") {
      const promise = testTcpMutation.mutateAsync({ url: monitor.url });

      toast.promise(promise, {
        loading: "Testing TCP connection...",
        success: "TCP test completed successfully",
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "TCP test failed";
        },
      });
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden font-medium text-muted-foreground lg:inline-block">
        Last ping 5m ago
        <span className="relative ml-1.5 inline-flex">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/80 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={testAction}
            >
              <Zap />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Test Monitor</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Monitor",
          confirmationValue: "delete monitor",
          submitAction: async () => {
            await deleteMonitorMutation.mutateAsync({ id: parseInt(id) });
          },
        }}
      />
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </div>
  );
}
