"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import { insertInvitationSchema } from "@openstatus/db/src/schema";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

const schema = insertInvitationSchema.pick({ email: true });
type Schema = z.infer<typeof schema>;

export function InviteButton({
  defaultValues,
  disabled,
}: {
  defaultValues?: Schema;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(data: Schema) {
    startTransition(async () => {
      try {
        api.invitation.create.mutate(data);
        toastAction("saved");
        router.refresh();
      } catch {
        toastAction("error");
      } finally {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen((v) => !v)} disabled={disabled}>
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite your team members!</DialogTitle>
          <DialogDescription>
            They will receive an email invite to join your workspace.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-6"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="sm:col-span-5">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    We will send an invite to this email address.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-full">
              <Button className="w-full sm:w-auto" size="lg">
                {!isPending ? "Confirm" : <LoadingAnimation />}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
