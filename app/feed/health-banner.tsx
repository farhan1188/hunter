import Link from "next/link";
import type { AdapterRow } from "@/src/profile/store";

export function HealthBanner({
  adapters,
  staleRoutines,
}: {
  adapters: AdapterRow[];
  staleRoutines: string[];
}) {
  const broken = adapters.filter(
    (a) => a.consecutive_failures >= 3 || (a.enabled && a.last_error)
  );
  if (broken.length === 0 && staleRoutines.length === 0) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
      {broken.length > 0 && (
        <div>
          <strong className="text-red-800">
            {broken.length} adapter{broken.length === 1 ? "" : "s"} unhealthy:
          </strong>{" "}
          {broken.map((b) => b.name).join(", ")}.{" "}
          <Link href="/settings" className="text-red-700 underline">
            Check settings
          </Link>
        </div>
      )}
      {staleRoutines.length > 0 && (
        <div className="mt-1">
          <strong className="text-red-800">Routines not running:</strong>{" "}
          {staleRoutines.join(", ")}
        </div>
      )}
    </div>
  );
}
