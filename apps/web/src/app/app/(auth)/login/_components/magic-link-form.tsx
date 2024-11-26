"use client";

import { useFormStatus } from "react-dom";

import { Button, Input, Label } from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { getPathnamePrefix } from "@/lib/pathname-prefix/client";
import { toast, toastAction } from "@/lib/toast";
import { signInWithResendAction } from "./actions";

/**
 * @deprecated - only to be used in development mode
 */
export default function MagicLinkForm() {
  const { pending } = useFormStatus();
  const prefix = getPathnamePrefix();

  return (
    <form
      action={async (formData) => {
        try {
          await signInWithResendAction(formData);
          toast.success("Check your terminal for the magic link.");
        } catch (_e) {
          toastAction("error");
        }
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="redirectTo" value={`${prefix}/login`} />
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button variant="secondary" className="w-full">
        {pending ? <LoadingAnimation /> : "Console magic link"}
      </Button>
    </form>
  );
}
