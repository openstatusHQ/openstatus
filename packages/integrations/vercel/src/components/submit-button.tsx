"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";

export function SubmitButton({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="bg-foreground text-background rounded-md px-2 py-1 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Loading" : children}
    </button>
  );
}
