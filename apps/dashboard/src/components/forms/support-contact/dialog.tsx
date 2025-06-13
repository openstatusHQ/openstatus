import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactForm, type FormValues } from "./form";
import { useState } from "react";

export function FormDialogSupportContact({
  children,
  defaultValues,
  ...props
}: React.ComponentProps<typeof DialogTrigger> & {
  defaultValues?: FormValues;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger {...props} asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Support</DialogTitle>
          <DialogDescription>
            Please fill out the form below to get in touch with us.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          defaultValues={defaultValues}
          onSubmit={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
