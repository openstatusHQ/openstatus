"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { wait } from "@/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// EXAMPLE
export function DialogForm() {
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // either like that or with a user action
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));

    console.log(data); // { url: "" }
    await wait(1500);
    // save data

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
          <DialogDescription>
            Type an URL that you want to ping periodically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="monitor">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="url">Link</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://"
              required
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="monitor" disabled={saving}>
            {!saving ? "Confirm" : <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
