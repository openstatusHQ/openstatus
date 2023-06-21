"use client";
import { toast } from "@/components/ui/use-toast";
import { addToWaitlist } from "../action";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./submit-button";

export const HeroForm = () => {
  return (
    <form
      action={async (data) => {
        try {
          const number = await addToWaitlist(data);
          const formattedNumber = Intl.NumberFormat().format(number);
          toast({
            description: `Thank you, you're number ${formattedNumber} on the list.`,
          });
        } catch (e) {
          toast({
            description: "Something went wrong",
          });
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
