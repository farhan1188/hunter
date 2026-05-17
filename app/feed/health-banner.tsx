import Link from "next/link";
import type { AdapterRow } from "@/src/profile/store";

// Only show what's actionable to the user. Stale-routine warnings about
// optional cloud jobs (backup, reconciler, notify-digest) are noise until
// you actually deploy them. Only surface routines the user has reason to
// care about: the LinkedIn pull, the tailor, and the auto-submitter.
const USER_FACING_ROUTINES = new Set(["harvestapi", "tailor", "submit"]);

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
  const relevantStale = staleRoutines.filter((n) => USER_FACING_ROUTINES.has(n));
  if (broken.length === 0 && relevantStale.length === 0) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
      {broken.length > 0 && (
        <div>
          <strong className="text-red-800">
            {broken.length} source{broken.length === 1 ? " is" : "s are"} unhealthy:
          </strong>{" "}
          {broken.map((b) => b.name).join(", ")}.{" "}
          <Link href="/settings" className="text-red-700 underline">
            Check settings
          </Link>
        </div>
      )}
      {relevantStale.length > 0 && (
        <div className="mt-1 text-red-800">
          Heads up: the {relevantStale.join(", ")} routine{relevantStale.length === 1 ? "" : "s"} hasn&apos;t run recently.
        </div>
      )}
    </div>
  );
}
