const styles: Record<string, string> = {
  approved: "bg-success-soft text-success",
  healthy: "bg-success-soft text-success",
  recovered: "bg-accent-soft text-accent",
  active: "bg-success-soft text-success",
  paused: "bg-surface-sunken text-ink-muted",
  pending: "bg-warning-soft text-warning",
  degraded: "bg-warning-soft text-warning",
  declined: "bg-danger-soft text-danger",
  offline: "bg-danger-soft text-danger",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? "bg-surface-sunken text-ink-muted"
      }`}
    >
      {status}
    </span>
  );
}
