"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/shell/icon";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );
  const [revealed, setRevealed] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          className="mt-1.5 w-full rounded-[var(--brand-radius)] border border-line-strong bg-surface-raised px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            name="password"
            type={revealed ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-[var(--brand-radius)] border border-line-strong bg-surface-raised py-2.5 pl-3 pr-11 text-sm"
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            aria-controls="password"
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--brand-radius)] text-ink-muted transition-colors hover:text-ink"
          >
            <Icon name={revealed ? "eye-off" : "eye"} className="size-[18px]" />
          </button>
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--brand-radius)] bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--brand-radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
