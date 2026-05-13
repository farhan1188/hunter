"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdapterRow } from "@/src/profile/store";

export function AdaptersList({
  initial,
  registered,
}: {
  initial: AdapterRow[];
  registered: string[];
}) {
  // Show every registered adapter; if it's not in `initial`, treat as enabled=false / empty config.
  const merged: AdapterRow[] = registered.map((name) => {
    const existing = initial.find((a) => a.name === name);
    return (
      existing ?? {
        name,
        enabled: false,
        config_json: "{}",
        last_run_at: null,
        last_error: null,
        consecutive_failures: 0,
      }
    );
  });

  const [rows, setRows] = useState(merged);
  const router = useRouter();

  async function toggle(name: string, enabled: boolean) {
    setRows((rs) =>
      rs.map((r) => (r.name === name ? { ...r, enabled } : r))
    );
    const row = rows.find((r) => r.name === name);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "adapter_upsert",
        name,
        enabled,
        config: JSON.parse(row?.config_json || "{}"),
      }),
    });
    router.refresh();
  }

  async function updateConfig(name: string, config_json: string) {
    setRows((rs) =>
      rs.map((r) => (r.name === name ? { ...r, config_json } : r))
    );
    let parsed: object;
    try {
      parsed = JSON.parse(config_json || "{}");
    } catch {
      return; // don't save invalid JSON; user gets immediate visual feedback
    }
    const row = rows.find((r) => r.name === name);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "adapter_upsert",
        name,
        enabled: row?.enabled ?? false,
        config: parsed,
      }),
    });
  }

  return (
    <div className="mt-2 divide-y">
      {rows.map((r) => (
        <div key={r.name} className="flex items-start gap-4 py-3">
          <div className="w-40 pt-1 font-mono text-sm">{r.name}</div>
          <Switch
            checked={r.enabled}
            onCheckedChange={(v) => toggle(r.name, v)}
          />
          <div className="flex-1">
            <Textarea
              className="font-mono text-xs"
              rows={2}
              value={r.config_json}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((rr) =>
                    rr.name === r.name
                      ? { ...rr, config_json: e.target.value }
                      : rr
                  )
                )
              }
              onBlur={(e) => updateConfig(r.name, e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              last run: {r.last_run_at ?? "never"}
              {r.last_error && (
                <span className="ml-2 text-red-600">
                  error: {r.last_error}
                </span>
              )}
              {r.consecutive_failures > 0 && (
                <span className="ml-2 text-yellow-600">
                  {r.consecutive_failures} consecutive failures
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
