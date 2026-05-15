"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PasteUrlForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^https?:\/\//.test(url)) {
      setError("URL must start with http:// or https://");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setUrl("");
        if (data.applicationId) {
          router.push(`/pipeline/${data.applicationId}`);
        } else {
          router.refresh();
          setError(`Score ${data.score ?? "n/a"} below threshold; not qualified.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        name="url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a job URL"
        className="h-9 w-64 rounded border px-3 text-sm"
        disabled={busy}
      />
      <button
        type="submit"
        className="h-9 rounded border px-3 text-sm disabled:opacity-50"
        disabled={busy || !url}
      >
        {busy ? "Importing…" : "Import"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
