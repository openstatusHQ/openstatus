"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { toast } from "@/lib/toast";
import { api } from "@/trpc/client";
import { LoadingAnimation } from "../loading-animation";

// or insertWorkspaceSchema.pick({ name: true }) and updating name to not be nullable
const schema = z.object({
  name: z.string().min(3, "workspace names must contain at least 3 characters"),
});
type Schema = z.infer<typeof schema>;

export function WorkspaceForm({ defaultValues }: { defaultValues: Schema }) {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(data: Schema) {
    startTransition(async () => {
      try {
        await api.workspace.updateWorkspace.mutate(data);
        toast("saved");
        router.refresh();
      } catch {
        toast("error");
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-4">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Documenso" {...field} />
              </FormControl>
              <FormDescription>The name of your workspace.</FormDescription>
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
  );
}
