"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

import { LoadingAnimation } from "@/components/loading-animation";
import { useCookieState } from "@/hooks/use-cookie-state";
import { toast, toastAction } from "@/lib/toast";
import { createProtectedCookieKey } from "../utils";
import { handleValidatePassword } from "./actions";

// TODO: share status page with hashed password as search param to add password to cookie
// TODO: check password managers how they work, maybe we need type="password" with a classname to show the password to store it (do the same for setting?)

const schema = z.object({
  password: z.string(),
});

type Schema = z.infer<typeof schema>;

export function PasswordForm({ slug }: { slug: string }) {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [_, handleChange] = useCookieState(createProtectedCookieKey(slug)); // what if we do not define the expires date?

  async function onSubmit(data: Schema) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("password", data.password);
        formData.append("slug", slug);

        const res = await handleValidatePassword(formData);

        if (res?.error) {
          toast.error(res.error || "An error occurred. Please retry.");
          return;
        }

        if (res.data === undefined) {
          toast.error("An error occurred. Please retry.");
          return;
        }

        handleChange(res.data);
        toastAction("saved");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full gap-4"
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="top-secret" {...field} />
              </FormControl>
              <FormDescription>
                Enter the password to access the status page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button size="lg">
          {!isPending ? "Confirm" : <LoadingAnimation />}
        </Button>
      </form>
    </Form>
  );
}
