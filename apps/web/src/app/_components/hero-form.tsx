"use client";

import { Input } from "@openstatus/ui";

import { toast } from "@/lib/toast";
import { addToWaitlist, sendWaitingListEmail } from "../action";
import { SubmitButton } from "./submit-button";

export const HeroForm = () => {
  return (
    <form
      action={async (data) => {
        try {
          const number = await addToWaitlist(data);
          const formattedNumber = Intl.NumberFormat().format(Number(number));
          toast.message("Thank you", {
            description: `You're number ${formattedNumber} on the list.`,
          });
          const email = data.get("email");
          if (email) {
            sendWaitingListEmail(String(email));
          }
        } catch (e) {
          toast.error("Something went wrong");
        }
      }}
      className="flex gap-1.5"
    >
      <Input
        id="email"
        name="email"
        type="email"
        placeholder="me@domain.com"
        required
      />
      <SubmitButton />
    </form>
  );
};
