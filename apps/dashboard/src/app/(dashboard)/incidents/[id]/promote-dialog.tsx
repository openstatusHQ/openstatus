"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

export function PromoteDialog({
  incidentId,
  defaultTitle,
}: {
  incidentId: number;
  defaultTitle: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pageId, setPageId] = useState<string>("");
  const [message, setMessage] = useState("");

  const { data: pages } = useQuery(trpc.page.list.queryOptions());

  const promote = useMutation(
    trpc.incident.promote.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.incident.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.incident.get.queryKey({ id: incidentId }),
        });
        toast.success("Published as a status report");
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Publish</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish “{defaultTitle}”</DialogTitle>
          <DialogDescription>
            Creates a status report on the page you choose, seeded from this
            incident. This is the only step that makes it public.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="page">Status page</Label>
            <Select value={pageId} onValueChange={setPageId}>
              <SelectTrigger id="page">
                <SelectValue placeholder="Select a page" />
              </SelectTrigger>
              <SelectContent>
                {pages?.map((page) => (
                  <SelectItem key={page.id} value={String(page.id)}>
                    {page.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">First public update</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="We are investigating elevated error rates."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              !pageId || message.trim().length === 0 || promote.isPending
            }
            onClick={() =>
              promote.mutate({
                id: incidentId,
                pageId: Number(pageId),
                pageComponentIds: [],
                message: message.trim(),
              })
            }
          >
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
