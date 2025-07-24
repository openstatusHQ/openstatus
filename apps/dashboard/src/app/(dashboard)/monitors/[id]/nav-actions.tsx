"use client";

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
import { NavFeedback } from "@/components/nav/nav-feedback";
import type { RouterOutputs } from "@openstatus/api";
import { DataTableSheetTest } from "@/components/data-table/response-logs/data-table-sheet-test";
import { deserialize } from "@openstatus/assertions";

type TestTCP = RouterOutputs["checker"]["testTcp"];
type TestHTTP = RouterOutputs["checker"]["testHttp"];

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestTCP | TestHTTP | null>(null);
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
      const assertions = deserialize(monitor.assertions ?? "[]");
      const promise = testHttpMutation.mutateAsync({
        url: monitor.url,
        body: monitor.body,
        method: monitor.method,
        headers: monitor.headers,
        assertions: assertions.map((a) => a.schema),
      });

      toast.promise(promise, {
        loading: "Testing HTTP request...",
        success: (data) => {
          setTest(data);
          return "HTTP test completed successfully";
        },
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
        success: (data) => {
          setTest(data);
          return "TCP test completed successfully";
        },
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "TCP test failed";
        },
      });
    }
  }

  if (!monitor) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <div className="hidden font-medium text-muted-foreground lg:inline-block">
        {!monitor.active ? (
          <span className="relative ml-1.5 inline-flex">
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground/70" />
          </span>
        ) : monitor.status === "active" ? (
          <span className="relative ml-1.5 inline-flex">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/80 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
        ) : monitor.status === "error" ? (
          <span className="relative ml-1.5 inline-flex">
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
          </span>
        ) : (
          <span className="relative ml-1.5 inline-flex">
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
          </span>
        )}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="group h-7 w-7"
              type="button"
              onClick={testAction}
            >
              <Zap className="text-muted-foreground group-hover:text-foreground" />
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
      <DataTableSheetTest
        data={test}
        monitor={monitor}
        onClose={async () => {
          await new Promise((resolve) => setTimeout(() => resolve(true), 300));
          setTest(null);
        }}
      />
    </div>
  );
}
