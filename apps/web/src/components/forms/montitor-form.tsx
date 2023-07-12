"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import {
  insertMonitorSchema,
  periodicityEnum,
} from "@openstatus/db/src/schema";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// EXAMPLE
export function MonitorCreateForm() {
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const params = useParams();
  const router = useRouter();

  const form = useForm<z.infer<typeof insertMonitorSchema>>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      workspaceId: Number(params.workspaceId),
    },
  });

  // either like that or with a user action
  async function onSubmit(values: z.infer<typeof insertMonitorSchema>) {
    setSaving(true);
    // await api.monitor.getMonitorsByWorkspace.revalidate();
    await api.monitor.createMonitor.mutate(values);
    router.refresh();
    setOpen(false);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>
        <Button>Create</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Monitor</DialogTitle>
          <DialogDescription>Create a monitor</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="monitor">
            <div className="grid w-full items-center  space-y-6">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormDescription>
                      This is url you want to monitor.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name of the monitor that will be displayed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormDescription>
                      Give your user some information about it.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodicity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(periodicityEnum.parse(value))
                      }
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="How often it should check" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1m" disabled>
                          1 minute
                        </SelectItem>
                        <SelectItem value="5m" disabled>
                          5 minutes
                        </SelectItem>
                        <SelectItem value="10m">10 minutes</SelectItem>
                        <SelectItem value="30m" disabled>
                          30 minutes
                        </SelectItem>
                        <SelectItem value="1h" disabled>
                          1 hour
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      You can manage email addresses in your{" "}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button type="submit" form="monitor" disabled={saving}>
            {!saving ? "Confirm" : <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
