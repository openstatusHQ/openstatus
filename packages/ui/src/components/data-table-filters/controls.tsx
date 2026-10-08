"use client";

import {
  CONTROLS_COOKIE_MAX_AGE,
  CONTROLS_COOKIE_NAME,
} from "@openstatus/ui/lib/data-table-filters/cookie";
import { createContext, useCallback, useContext, useState } from "react";

interface ControlsContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ControlsContext = createContext<ControlsContextType | null>(null);

export function ControlsProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode;
  /**
   * Read `CONTROLS_COOKIE_NAME` on the server and pass it in to persist the
   * panel across loads; without it the panel reopens on every reload.
   */
  defaultOpen?: boolean;
}) {
  const [open, setOpenState] = useState(defaultOpen);

  const setOpen = useCallback(
    (value: React.SetStateAction<boolean>) => {
      const next = value instanceof Function ? value(open) : value;
      setOpenState(next);
      document.cookie = `${CONTROLS_COOKIE_NAME}=${next}; path=/; max-age=${CONTROLS_COOKIE_MAX_AGE}`;
    },
    [open],
  );

  return (
    <ControlsContext.Provider value={{ open, setOpen }}>
      <div
        // REMINDER: access the data-expanded state with tailwind via `group-data-[expanded=true]/controls:block`
        // In tailwindcss v4, we could even use `group-data-expanded/controls:block`
        // `contents` so the group never becomes a box in the height chain
        className="group/controls contents"
        data-expanded={open}
      >
        {children}
      </div>
    </ControlsContext.Provider>
  );
}

export function useControls() {
  const context = useContext(ControlsContext);

  if (!context) {
    throw new Error("useControls must be used within a ControlsProvider");
  }

  return context as ControlsContextType;
}
