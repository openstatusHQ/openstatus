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
