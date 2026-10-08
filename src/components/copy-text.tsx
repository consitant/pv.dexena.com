"use client";

import { useState } from "react";

export function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <code className="break-all rounded bg-mist px-2 py-1 font-mono text-sm">{value}</code>
      <button
        type="button"
        className="btn btn-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </span>
  );
}
