export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-foreground pointer-events-none flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono font-mono text-[10px] font-medium opacity-100">
      {children}
    </kbd>
  );
}
