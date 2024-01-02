"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle } from "lucide-react";

import type { Monitor } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { useToastAction } from "@/hooks/use-toast-action";
import { api } from "@/trpc/client";

export function PauseButton({ monitor }: { monitor: Monitor }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToastAction();

  async function toggle() {
    startTransition(async () => {
      try {
        await api.monitor.update.mutate({
          ...monitor,
          active: !monitor.active,
        });
        toast("success");
        router.refresh();
      } catch {
        toast("error");
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
