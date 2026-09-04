"use client";

import type { RouterOutputs } from "@openstatus/api";
import { deserialize } from "@openstatus/assertions";
import { Speed } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { buildCurlCommand } from "@openstatus/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DataTableSheetTest } from "@/components/data-table/response-logs/data-table-sheet-test";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { NavFeedback } from "@/components/nav/nav-feedback";
import { getActions } from "@/data/monitors.client";
import { useTRPC } from "@/lib/trpc/client";

type TestTCP = RouterOutputs["checker"]["testTcp"];
type TestHTTP = RouterOutputs["checker"]["testHttp"];
type TestDNS = RouterOutputs["checker"]["testDns"];
type TestICMP = RouterOutputs["checker"]["testIcmp"];
type TestGRPC = RouterOutputs["checker"]["testGrpc"];

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<
    TestTCP | TestHTTP | TestDNS | TestICMP | TestGRPC | null
  >(null);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();

  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
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
    }),
  );

  const cloneMonitorMutation = useMutation(
    trpc.monitor.clone.mutationOptions({
      onSuccess: (newMonitor) => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        router.push(`/monitors/${newMonitor.id}`);
      },
    }),
  );

  const testHttpMutation = useMutation(trpc.checker.testHttp.mutationOptions());
  const testTcpMutation = useMutation(trpc.checker.testTcp.mutationOptions());
  const testDnsMutation = useMutation(trpc.checker.testDns.mutationOptions());
  const testIcmpMutation = useMutation(trpc.checker.testIcmp.mutationOptions());
  const testGrpcMutation = useMutation(trpc.checker.testGrpc.mutationOptions());

  // curl only speaks HTTP — the action is hidden for tcp/dns monitors
  const curlCommand =
    monitor?.jobType === "http" ? buildCurlCommand(monitor) : null;

  const actions = getActions({
    edit: () => router.push(`/monitors/${id}/edit`),
    "copy-id": async () => {
      await navigator.clipboard.writeText(id);
      toast.success("Monitor ID copied to clipboard");
    },
    "copy-curl": curlCommand
      ? async () => {
          await navigator.clipboard.writeText(curlCommand);
          toast.success("cURL command copied to clipboard");
        }
      : undefined,
    clone: () => {
      const promise = cloneMonitorMutation.mutateAsync({
        id: Number.parseInt(id),
      });
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
  }).filter((action) => action.id !== "copy-curl" || Boolean(curlCommand));

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
    } else if (monitor?.jobType === "dns") {
      const assertions = deserialize(monitor.assertions ?? "[]");
      const promise = testDnsMutation.mutateAsync({
        url: monitor.url,
        assertions: assertions.map((a) => a.schema),
      });

      toast.promise(promise, {
        loading: "Testing DNS request...",
        success: (data) => {
          setTest(data);
          return "DNS test completed successfully";
        },
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "DNS test failed";
        },
      });
    } else if (monitor?.jobType === "icmp") {
      const promise = testIcmpMutation.mutateAsync({ url: monitor.url });

      toast.promise(promise, {
        loading: "Testing ICMP request...",
        success: (data) => {
          setTest(data);
          return "ICMP test completed successfully";
        },
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "ICMP test failed";
        },
      });
    } else if (monitor?.jobType === "grpc") {
      const promise = testGrpcMutation.mutateAsync({
        url: monitor.url,
        service: monitor.grpcService ?? undefined,
        tls: monitor.grpcTls ?? "tls",
        headers: monitor.headers ?? [],
      });

      toast.promise(promise, {
        loading: "Testing gRPC request...",
        success: (data) => {
          setTest(data);
          return "gRPC test completed successfully";
        },
        error: (error) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "gRPC test failed";
        },
      });
    }
  }

  if (!monitor) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <div className="text-muted-foreground hidden font-medium lg:inline-block">
        <Tooltip>
          <TooltipTrigger asChild>
            {!monitor.active ? (
              <span className="relative ml-1.5 inline-flex">
                <span className="bg-muted-foreground/70 relative inline-flex h-2.5 w-2.5 rounded-full" />
              </span>
            ) : monitor.status === "active" ? (
              <span className="relative ml-1.5 inline-flex">
                <span className="bg-success/80 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-success relative inline-flex h-2.5 w-2.5 rounded-full" />
              </span>
            ) : monitor.status === "error" ? (
              <span className="relative ml-1.5 inline-flex">
                <span className="bg-destructive relative inline-flex h-2.5 w-2.5 rounded-full" />
              </span>
            ) : (
              <span className="relative ml-1.5 inline-flex">
                <span className="bg-warning relative inline-flex h-2.5 w-2.5 rounded-full" />
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>
            {!monitor.active
              ? "Inactive"
              : monitor.status === "active"
                ? "Normal"
                : monitor.status === "error"
                  ? "Failing"
                  : "Degraded"}
          </TooltipContent>
        </Tooltip>
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
              <Speed className="text-muted-foreground group-hover:text-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Test Monitor</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: monitor.name ?? "monitor",
          submitAction: async () => {
            await deleteMonitorMutation.mutateAsync({
              id: Number.parseInt(id),
            });
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
