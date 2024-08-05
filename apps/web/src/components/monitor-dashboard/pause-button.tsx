"use client";

import { PauseCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Monitor } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui/src/components/button";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

export function PauseButton({ monitor }: { monitor: Monitor }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    startTransition(async () => {
      try {
        await api.monitor.update.mutate({
          ...monitor,
          active: !monitor.active,
        });
        toastAction("success");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <Button
      variant={monitor.active ? "outline" : "default"}
      onClick={toggle}
      disabled={isPending}
    >
      {isPending ? (
        <LoadingAnimation variant={monitor.active ? "inverse" : "default"} />
      ) : (
        <>
          {monitor.active ? (
            <>
              <PauseCircle className="mr-2 h-4 w-4" /> Pause
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" /> Resume
            </>
          )}
        </>
      )}
    </Button>
  );
}
