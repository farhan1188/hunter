import { listFeed } from "@/src/core/jobs/query";
import { listAdapters } from "@/src/profile/store";
import { staleRoutines } from "./heartbeat";

export async function buildDailyDigest(): Promise<{
  subject: string;
  body: string;
}> {
  const top = (await listFeed({ limit: 20 })).filter(
    (r) => (r.score ?? 0) >= 70
  );
  const adapters = await listAdapters();
  const broken = adapters.filter((a) => a.consecutive_failures >= 3);
  const stale = await staleRoutines();

  const lines: string[] = [];
  lines.push(
    `Job Hunter daily digest — ${new Date().toLocaleDateString()}`
  );
  lines.push("");
  lines.push(`Top jobs (score >= 70): ${top.length}`);
  for (const j of top.slice(0, 10)) {
    lines.push(
      `  [${j.score}] ${j.title} @ ${j.company.name} (${j.source}) — ${j.url}`
    );
  }
  lines.push("");
  if (broken.length > 0)
    lines.push(
      `Unhealthy adapters: ${broken.map((b) => b.name).join(", ")}`
    );
  if (stale.length > 0) lines.push(`Stale routines: ${stale.join(", ")}`);
  if (broken.length === 0 && stale.length === 0)
    lines.push("All systems nominal.");
  return {
    subject: `[Job Hunter] ${top.length} jobs >=70 today`,
    body: lines.join("\n"),
  };
}
