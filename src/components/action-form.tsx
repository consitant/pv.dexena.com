"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { ActionState } from "./action-state";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  confirm?: string;
};

/** Formular für Server Actions mit Fehler-/Erfolgsanzeige und einmaliger Geheimnis-Anzeige. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Speichern …",
  className,
  buttonClassName = "btn btn-primary",
  confirm,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className ?? "space-y-3"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state.error && <p className="text-sm text-[#b8432a]" role="alert">{state.error}</p>}
        {state.ok && state.message && !state.secret && <p className="text-sm text-emerald-700" role="status">{state.message}</p>}
      </div>
      {state.secret && <SecretBox label={state.secretLabel ?? "Geheimnis"} value={state.secret} message={state.message} />}
    </form>
  );
}

export function SecretBox({ label, value, message }: { label: string; value: string; message?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-purple/40 bg-mist p-3">
      {message && <p className="mb-1 text-sm font-semibold text-emerald-800">{message}</p>}
      <p className="text-xs font-bold text-purple">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="break-all rounded-xl bg-white px-2 py-1 font-mono text-sm">{value}</code>
        <button
          type="button"
          className="btn btn-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? "Kopiert" : "Kopieren"}
        </button>
      </div>
    </div>
  );
}
