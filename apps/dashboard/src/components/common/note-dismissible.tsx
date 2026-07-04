"use client";

import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { createContext, useContext } from "react";

import { Note, NoteButtonClose } from "@/components/common/note";

const DismissedNotesContext = createContext<string[]>([]);

/** Server layout seeds the dismissed `note_*` cookie keys to avoid a flash before hydration. */
export function DismissedNotesProvider({
  dismissed,
  children,
}: {
  dismissed: string[];
  children: React.ReactNode;
}) {
  return (
    <DismissedNotesContext.Provider value={dismissed}>
      {children}
    </DismissedNotesContext.Provider>
  );
}

export function NoteDismissible({
  cookieKey,
  children,
  ...props
}: React.ComponentProps<typeof Note> & {
  // the layout seeds dismissed state only for cookies matching this prefix
  cookieKey: `note_${string}`;
}) {
  const dismissed = useContext(DismissedNotesContext);
  // no config: the hook's number `expires` builds an invalid cookie (session-only); the bare setter uses a valid 1y expiry
  const [open, setOpen] = useCookieState<"true" | "false">(cookieKey);

  const visible =
    open === undefined ? !dismissed.includes(cookieKey) : open === "true";

  if (!visible) return null;

  return (
    <Note {...props}>
      {children}
      <NoteButtonClose onClick={() => setOpen("false")} />
    </Note>
  );
}
