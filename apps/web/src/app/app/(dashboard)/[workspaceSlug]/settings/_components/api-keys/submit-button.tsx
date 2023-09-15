"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";

import { LoadingAnimation } from "@/components/loading-animation";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="disabled:opacity-100">
      {pending ? <LoadingAnimation /> : children}
    </Button>
  );
}
