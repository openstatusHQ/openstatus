export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono font-mono text-[10px] text-foreground opacity-100">
      {children}
    </kbd>
  );
}
