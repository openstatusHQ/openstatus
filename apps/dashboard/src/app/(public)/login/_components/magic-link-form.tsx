"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signInWithResendAction } from "./actions";

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
      <Button variant="secondary" className="w-full">
        {pending ? "Logging..." : "Log magic link"}
      </Button>
    </form>
  );
}
