"use client";
import { auth } from "@/lib/auth";
import { Button } from "@openstatus/ui";
import { Redis } from "@upstash/redis";
import { useState } from "react";
import { RequestAccessToRum } from "./action";

export const RequestButton = async ({
  hasRequestAccess,
}: {
  hasRequestAccess: number;
}) => {
  const [accessRequested, setAccessRequested] = useState(hasRequestAccess);
  if (accessRequested) {
    return (
      <Button>
        <span>Access requested</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={async () => {
        // const session = await auth();
        // if (!session?.user) return;
        await RequestAccessToRum();
        setAccessRequested(1);
      }}
    >
      Request access
    </Button>
  );
};
