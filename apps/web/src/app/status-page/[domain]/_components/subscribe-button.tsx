"use client";

import { Mail } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { handleSubscribe } from "./actions";

interface Props {
  slug: string;
}

export function SubscribeButton({ slug }: Props) {
  const { toast } = useToast();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          Get updates
        </Button>
      </PopoverTrigger>
      <PopoverContent>
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
              const res = await handleSubscribe(formData);
              if (res?.error) {
                toast({
                  title: "Something went wrong",
                  description: res.error,
                  variant: "destructive",
                });
                return;
              }
              toast({
                title: "Success",
                description: "Please confirm your email.",
              });
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
