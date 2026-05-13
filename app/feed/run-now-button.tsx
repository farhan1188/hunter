"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunNowButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function go() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routine: "ingest" }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "failed" }));
      setError(typeof error === "string" ? error : JSON.stringify(error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={go} disabled={pending}>
        {pending ? "Triggering..." : "Run Ingest now"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
