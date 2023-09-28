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

export const NotificationDialog = () => {
  const onSubmit = () => {
    console.log("submit here");
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

            <Select>
              <SelectTrigger id="framework">
                <SelectValue placeholder="Select" defaultValue={"email"} />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              defaultValue=""
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
