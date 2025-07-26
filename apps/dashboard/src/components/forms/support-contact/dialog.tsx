import { Link } from "@/components/common/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ContactForm, type FormValues } from "./form";

export function FormDialogSupportContact({
  children,
  defaultValues,
  ...props
}: React.ComponentProps<typeof DialogTrigger> & {
  defaultValues?: FormValues;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const feedbackMutation = useMutation(trpc.feedback.submit.mutationOptions());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger {...props} asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Support</DialogTitle>
          <DialogDescription>
            Please fill out the form below to get in touch with us. Or send us
            an email to{" "}
            <Link href="mailto:ping@openstatus.dev">ping@openstatus.dev</Link>.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          defaultValues={{
            name: defaultValues?.name ?? user?.name ?? undefined,
            email: defaultValues?.email ?? user?.email ?? undefined,
            type: defaultValues?.type,
            message: defaultValues?.message,
            blocker: defaultValues?.blocker,
          }}
          onSubmit={async (data) => {
            await feedbackMutation.mutateAsync({
              name: data.name,
              email: data.email,
              type: data.type,
              message: data.message,
              blocker: data.blocker,
              path: window.location.pathname,
              isMobile,
            });
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
