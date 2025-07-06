import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { ContactForm, type FormValues } from "./form";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/components/common/link";

export function FormDialogSupportContact({
  children,
  defaultValues,
  ...props
}: React.ComponentProps<typeof DialogTrigger> & {
  defaultValues?: FormValues;
}) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());

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
          onSubmit={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
