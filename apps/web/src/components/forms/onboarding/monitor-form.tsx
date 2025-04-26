"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import { insertMonitorSchema } from "@openstatus/db/src/schema";
import {
  Badge,
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
import { FailedPingAlertConfirmation } from "@/components/modals/failed-ping-alert-confirmation";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

// TODO: add pingEndpoint for testing including the Dialog to show the response

export function MonitorForm() {
  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      url: "",
    },
  });
  const router = useRouter();
  const [isPending, setPending] = React.useState(false);
  const [pingFailed, setPingFailed] = React.useState(false);

  const handleDataUpdateOrInsertion = async (props: InsertMonitor) => {
    // await api.monitor.create.mutate({
    //   name: props.url,
    //   ...props,
    // });
    // router.refresh();
  };

  const handleForceDataUpdateOrInsertion = async (props: InsertMonitor) => {
    try {
      handleDataUpdateOrInsertion(props);
      toastAction("saved");
    } catch (_error) {
      toastAction("error");
    }
  };

  const onSubmit = ({ ...props }: InsertMonitor) => {
    toast.promise(
      async () => {
        setPending(true);
        const response = await fetch(props.url);
        if (!response.ok) {
          setPingFailed(true);
          throw new Error("Endpoint is not working.");
        }
        await handleDataUpdateOrInsertion(props);
      },
      {
        loading: "Checking the endpoint before saving...",
        success: () => "Endpoint is working fine. Saved!",
        error: (error: Error) => {
          if (error instanceof Error) return error.message;
          return "Endpoint is not working.";
        },
        finally: () => {
          setPending(false);
        },
      },
    );
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://documenso.com" {...field} />
                </FormControl>
                <FormDescription>
                  Enter the URL to check or use the example URL:{" "}
                  <Button
                    type="button"
                    onClick={() => {
                      field.onChange("https://openstat.us/200");
                    }}
                    variant="outline"
                    size="sm"
                    className="px-2 h-7"
                  >
                    https://openstat.us/200
                  </Button>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button
              className="w-full sm:w-auto"
              size="lg"
              type="submit"
              disabled={isPending}
            >
              {!isPending ? "Create Monitor" : <LoadingAnimation />}
            </Button>
          </div>
        </form>
      </Form>
      <FailedPingAlertConfirmation
        monitor={form.getValues()}
        {...{ pingFailed, setPingFailed }}
        onConfirm={handleForceDataUpdateOrInsertion}
      />
    </>
  );
}
