"use client";

import { Mail } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";

import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";
import { wait } from "@/lib/utils";
import { Button } from "@openstatus/ui/src/components/button";
import { Input } from "@openstatus/ui/src/components/input";
import { Label } from "@openstatus/ui/src/components/label";
import { handleSubscribe } from "./actions";

interface Props {
  slug: string;
  isDemo?: boolean;
}

export function SubscribeButton({ slug, isDemo = false }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="rounded-full">
          Get updates
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="flex items-center font-medium leading-none">
              <Mail className="mr-2 h-4 w-4" /> Subscribe to updates
            </h4>
            <p className="text-muted-foreground text-sm">
              Get email notifications whenever a report has been created or
              resolved.
            </p>
          </div>
          <form
            className="grid gap-2"
            action={async (formData) => {
              if (!isDemo) {
                const res = await handleSubscribe(formData);
                if (res?.error) {
                  toast.error("Something went wrong", {
                    description: res.error,
                  });
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
      </PopoverContent>
    </Popover>
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
