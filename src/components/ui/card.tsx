export function Card({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[var(--brand-radius)] border border-line bg-surface-raised ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          {title && (
            <h2 className="font-display text-sm font-semibold tracking-tight">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
