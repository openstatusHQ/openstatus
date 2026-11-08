import { useHydrated } from "@/hooks/use-hydrated";

/** A focused field or an open overlay (select, menu, dialog) owns the keyboard; page shortcuts skip it. */
export function isKeyboardOwned(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, textarea, select") ||
      !!target.closest(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"]',
      ))
  );
}

/** ⌘/Ctrl+Esc clears the page filters, unless a field or overlay owns the keyboard. */
export function isResetShortcut(
  e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "repeat" | "target">,
) {
  return (
    e.key === "Escape" &&
    (e.metaKey || e.ctrlKey) &&
    !e.repeat &&
    !isKeyboardOwned(e.target)
  );
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere; ⌘ until hydrated. */
export function useModifierKey() {
  const hydrated = useHydrated();
  return hydrated ? getModifierKey(navigator.userAgent) : "⌘";
}

export function getModifierKey(userAgent: string) {
  return /Mac|iPhone|iPad|iPod/.test(userAgent) ? "⌘" : "Ctrl";
}
