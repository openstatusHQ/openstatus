"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

// TODO: add 'hide/show' button to show the password
// FIXME: we could do the `?authorize` thing in the server side (e.g. middleware) - but not
// in the `layout.tsx` because we cannot access the search params there

const schema = z.object({
  password: z.string(),
});

type Schema = z.infer<typeof schema>;

export function PasswordForm({ slug }: { slug: string }) {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [_, handleChange] = useCookieState(createProtectedCookieKey(slug)); // what if we do not define the expires date?

  useEffect(() => {
    if (searchParams.has("authorize")) {
      const authorize = searchParams.get("authorize");
      if (!authorize) return;
      form.setValue("password", authorize);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: Schema) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("password", data.password);
        formData.append("slug", slug);

        const res = await handleValidatePassword(formData);

        if (res?.error || res.data === undefined) {
          toast.error(res.error || "An error occurred. Please retry.");
          return;
        }

        handleChange(res.data);
        toastAction("saved");

        router.replace(pathname);
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
                <Input
                  placeholder="top-secret"
                  type="password"
                  disabled={loading}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Enter the password to access the status page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button size="lg" disabled={isPending || loading}>
          {isPending || loading ? <LoadingAnimation /> : "Confirm"}
        </Button>
      </form>
    </Form>
  );
}
