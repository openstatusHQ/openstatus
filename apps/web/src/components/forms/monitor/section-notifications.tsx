"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  InsertMonitor,
  Notification,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { getLimit } from "@openstatus/plans";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui";

import { NotificationForm } from "../notification-form";
import { CheckboxLabel } from "./checkbox-label";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  plan: WorkspacePlan;
  notifications?: Notification[];
}

export function SectionNotifications({ form, plan, notifications }: Props) {
  const [openDialog, setOpenDialog] = React.useState(false);

  const notificationLimit = getLimit(plan, "notification-channels");
  const notificationLimitReached = notifications
    ? notifications.length >= notificationLimit
    : false;
  return (
    <div className="grid w-full gap-4">
      {/* <div className="grid gap-1">
        <h4 className="text-foreground font-medium">Schedule and Regions</h4>
        <p className="text-muted-foreground text-sm">
          Customize the period of time and the regions where your endpoint will
          be monitored.
        </p>
      </div> */}
      <FormField
        control={form.control}
        name="notifications"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Notifications</FormLabel>
                <FormDescription>
                  Select the notification channels you want to be informed.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {notifications?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="notifications"
                    render={({ field }) => {
                      return (
                        <FormItem key={item.id} className="h-full w-full">
                          <FormControl className="h-full">
                            <CheckboxLabel
                              id={String(item.id)}
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value ? field.value : []),
                                      item.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id,
                                      ),
                                    );
                              }}
                            >
                              <span>{item.name}</span>
                              <span>
                                <Badge variant="secondary">
                                  {item.provider}
                                </Badge>
                              </span>
                            </CheckboxLabel>
                          </FormControl>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <Dialog open={openDialog} onOpenChange={(val) => setOpenDialog(val)}>
        <div>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={notificationLimitReached}>
              Add Notification Channel
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Notification</DialogTitle>
            <DialogDescription>
              Get alerted when your endpoint is down.
            </DialogDescription>
          </DialogHeader>
          <NotificationForm
            onSubmit={() => setOpenDialog(false)}
            workspacePlan={plan}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
