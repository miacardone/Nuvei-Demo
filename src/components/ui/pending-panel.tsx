import { Card } from "./card";

/**
 * Honest placeholder. These areas are scaffolded but intentionally not
 * invented — they get built against the real CPO specification.
 */
export function PendingPanel({ area }: { area: string }) {
  return (
    <Card>
      <div className="px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold tracking-tight">
          {area} is scaffolded, not yet specified
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          The route, navigation and theming are wired up. The screens themselves
          are waiting on the CPO specification so the flows match the real
          product rather than a guess.
        </p>
      </div>
    </Card>
  );
}
