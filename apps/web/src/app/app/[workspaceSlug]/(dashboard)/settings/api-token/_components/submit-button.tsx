"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";

export function SubmitButton({ children }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="disabled:opacity-100">
      {pending ? <LoadingAnimation /> : children}
    </Button>
  );
}
