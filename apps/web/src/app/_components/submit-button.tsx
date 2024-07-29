"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@openstatus/ui/src/components/button";

import { LoadingAnimation } from "@/components/loading-animation";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-auto w-20 disabled:opacity-100"
    >
      {pending ? <LoadingAnimation /> : "Join"}
    </Button>
  );
}
