"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UploadForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    setPending(false);
    if (!res.ok) {
      const { error } = await res
        .json()
        .catch(() => ({ error: "upload failed" }));
      setError(typeof error === "string" ? error : JSON.stringify(error));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        type="file"
        name="resume"
        accept="application/pdf"
        required
        disabled={pending}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Extracting..." : "Upload + extract"}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
