"use client";

import { Mail } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/src/components/dialog";

import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";
import { wait } from "@/lib/utils";
import { Button } from "@openstatus/ui/src/components/button";
import { Input } from "@openstatus/ui/src/components/input";
import { Label } from "@openstatus/ui/src/components/label";
import { handleSubscribe } from "./actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  isDemo?: boolean;
}

export function SubscribeModal({
  open,
  onOpenChange,
  slug,
  isDemo = false,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Subscribe to updates
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            Get email notifications whenever a report has been created or
            resolved.
          </p>

          <form
            className="grid gap-2"
            action={async (formData) => {
              if (!isDemo) {
                const res = await handleSubscribe(formData);
                if (res?.error) {
                  toast.error("Something went wrong", {
                    description: res.error,
                  });
                  onOpenChange(false);
                  return;
                }
                toast.message("Success", {
                  description: "Please confirm your email.",
                });
              } else {
                await wait(1000);
                toast.message("Success (Demo)", {
                  description: "Please confirm your email (not).",
                });
              }
              onOpenChange(false);
            }}
          >
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="notify@me.com"
            />
            <input type="hidden" name="slug" value={slug} />
            <SubmitButton />
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoadingAnimation /> : "Subscribe"}
    </Button>
  );
}
