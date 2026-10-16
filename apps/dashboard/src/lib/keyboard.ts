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

/** "⌘" on Apple platforms, "Ctrl" elsewhere; ⌘ until hydrated. */
export function useModifierKey() {
  const hydrated = useHydrated();
  return hydrated && !/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
    ? "Ctrl"
    : "⌘";
}
