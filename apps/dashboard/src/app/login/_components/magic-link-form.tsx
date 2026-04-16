"use client";

import { useFormStatus } from "react-dom";

import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { toast } from "sonner";
import { signInWithResendAction } from "./actions";
import { LoginButton } from "./login-button";

/**
 * @deprecated - only to be used in development mode
 */
export default function MagicLinkForm() {
  const { pending } = useFormStatus();

  return (
    <form
      action={async (formData) => {
        try {
          await signInWithResendAction(formData);
          toast.success("Check your terminal for the magic link.");
        } catch (e) {
          console.error(e);
          toast.error("Error sending magic link.");
        }
      }}
      className="grid gap-2"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <LoginButton provider="email">
        {pending ? "Logging..." : "Log Magic Link"}
      </LoginButton>
    </form>
  );
}
