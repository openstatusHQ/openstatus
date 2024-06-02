"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@openstatus/ui";

import { api } from "@/trpc/client";

// TODO: instead of setInterval, use staleWhileRevalidate method to fetch latest data
// also fetch data on page focus

export function RefreshWidget({ defaultValue }: { defaultValue?: number }) {
  const [refresh, setRefresh] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (refresh) return;
      const data = await api.tinybird.lastCronTimestamp.query();
      if (data && data?.length > 0) {
        const { cronTimestamp } = data[0];
        setValue(cronTimestamp);
        if (value && cronTimestamp > value) setRefresh(true);
      }
    }, 30_000);
    return () => {
      clearInterval(intervalId);
    };
  }, [refresh, value]);

  if (!refresh) return null;

  return (
    <div>
      <Button
        onClick={() => {
          router.refresh();
          setRefresh(false);
        }}
        variant="outline"
      >
        Refresh
      </Button>
    </div>
  );
}
