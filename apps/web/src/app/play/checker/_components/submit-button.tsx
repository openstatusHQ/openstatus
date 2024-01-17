"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";

import { Button } from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoadingAnimation /> : "Check"}
    </Button>
  );
}
