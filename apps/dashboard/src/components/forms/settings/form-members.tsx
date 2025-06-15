"use client";

import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  FormCardContent,
  FormCardDescription,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";

import { Button } from "@/components/ui/button";
import { FormCardFooter, FormCardFooterInfo } from "../form-card";

import { Link } from "@/components/common/link";
import { FormCard } from "@/components/forms/form-card";
import { Tabs } from "@/components/ui/tabs";
import { Lock } from "lucide-react";

import { DataTable as InvitationsDataTable } from "@/components/data-table/settings/invitations/data-table";
import { DataTable as MembersDataTable } from "@/components/data-table/settings/members/data-table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { members } from "@/data/members";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const LOCKED = true;

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["member"]),
});

type FormValues = z.infer<typeof schema>;

export function FormMembers() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        toast.promise(promise, {
          loading: "Saving...",
          success: () => JSON.stringify(values),
          error: "Failed to save",
        });
        await promise;
        form.reset();
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard>
          {LOCKED ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Team</FormCardTitle>
            <FormCardDescription>Manage your team members.</FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
              <TabsContent value="members">
                <MembersDataTable data={members} />
              </TabsContent>
              <TabsContent value="pending">
                <InvitationsDataTable data={[]} />
              </TabsContent>
            </Tabs>
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Add member</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Email" {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormCardDescription>
                    Send an invitation to join the team.
                  </FormCardDescription>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            {LOCKED ? (
              <>
                <FormCardFooterInfo>
                  This feature is available on the{" "}
                  <Link href="#">Pro plan</Link>.
                </FormCardFooterInfo>
                <Button type="button" size="sm" asChild>
                  <Link href="/dashboard/settings/billing">
                    <Lock />
                    Upgrade
                  </Link>
                </Button>
              </>
            ) : (
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            )}
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
