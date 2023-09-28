"use client";

import { useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { api } from "@/trpc/client";

export const NotificationDialog = ({
  monitorId,
  workspaceSlug,
}: {
  monitorId: number;
  workspaceSlug: string;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const onSubmit = async () => {
    console.log("submit here");
    await api.notification.createNotification.mutate({
      input: {
        name,
        provider: "email",
        data: { to: email },
      },
      monitorId: monitorId,
      workspaceSlug: workspaceSlug,
    });
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default">Add Notifications</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Notification</DialogTitle>
          <DialogDescription>
            Get alerted when your endpoint is down.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="framework">Providers</Label>

            <Select defaultValue="email">
              <SelectTrigger id="framework">
                <SelectValue placeholder="Select" defaultValue="email" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="col-span-3"
              type="email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
