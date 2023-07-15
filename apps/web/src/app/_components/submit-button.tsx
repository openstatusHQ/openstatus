"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";

import { LoadingAnimation } from "@/components/loading-animation";
import { Button } from "@/components/ui/button";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-20 disabled:opacity-100"
    >
      {pending ? <LoadingAnimation /> : "Join"}
    </Button>
  );
}
