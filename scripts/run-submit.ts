// Local submit runner. Loops the Local Agent across every Ready application,
// either in highlight-only mode (default — agent stops before Submit) or
// auto-submit mode (clicks Submit, marks DB).
//
// Honors:
//   - settings.submission_paused (global kill switch)
//   - settings.daily_cap   (max submissions per 24h)
//   - settings.weekly_cap  (max submissions per 7d)
//
// Flags:
//   --auto-submit            click Submit on each filled form
//   --max=N                  cap how many apps to process this run (default 10)
//   --include-ats-native     also process channel='ats_native' apps (default: skip,
//                            since those are intended for the cloud routine via Anthropic SDK).
//                            Use this for the locally-driven autonomous round.

import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { getDb } from "@/src/db/client";
import { getSettings } from "@/src/profile/store";
import { submittedLast24h, submittedLast7d } from "@/src/core/submit/caps";

interface RunSummary {
  considered: number;
  submitted: number;
  filled_only: number;
  failed: number;
  reasons: Record<string, number>;
}

interface Flags {
  autoSubmit: boolean;
  max: number;
  includeAtsNative: boolean;
}

function parseArgs(): Flags {
  const args = process.argv.slice(2);
  const flags: Flags = { autoSubmit: false, max: 10, includeAtsNative: false };
  for (const a of args) {
    if (a === "--auto-submit") flags.autoSubmit = true;
    else if (a === "--include-ats-native") flags.includeAtsNative = true;
    else {
      const m = a.match(/^--max=(\d+)$/);
      if (m) flags.max = parseInt(m[1], 10);
    }
  }
  return flags;
}

async function listReadyIds(opts: { includeAtsNative: boolean }): Promise<string[]> {
  const db = getDb();
  const channelClause = opts.includeAtsNative ? "" : "AND a.channel = 'local_agent'";
  const { rows } = await db.execute(
    `SELECT a.id FROM applications a
      WHERE a.state = 'ready' ${channelClause}
      ORDER BY a.created_at ASC`,
  );
  return rows.map((r) => r.id as string);
}

async function spawnAgent(applicationId: string, autoSubmit: boolean): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npm.cmd" : "npm";
    const passThrough = [`--application-id=${applicationId}`];
    if (autoSubmit) passThrough.push("--auto-submit");
    const proc = spawn(cmd, ["run", "agent", "--", ...passThrough], {
      cwd: path.join(process.cwd(), "agent"),
      env: { ...process.env, APPLICATION_ID: applicationId, ...(autoSubmit ? { AUTO_SUBMIT: "1" } : {}) },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += String(d); process.stdout.write(d); });
    proc.stderr.on("data", (d) => { stderr += String(d); process.stderr.write(d); });
    proc.on("close", (code) => resolve({ ok: code === 0, output: stdout + stderr }));
  });
}

function classify(output: string): "submitted" | "filled_only" | "failed" {
  if (/^SUBMITTED\b/m.test(output)) return "submitted";
  if (/^FAILED\b/m.test(output)) return "failed";
  if (/READY for click/m.test(output)) return "filled_only";
  return "failed";
}

async function main() {
  const flags = parseArgs();
  const db = getDb();
  const settings = await getSettings();

  if (settings.submission_paused) {
    console.log("Sending is paused (Settings → Pause all sending). Exiting.");
    return;
  }

  const sentToday = await submittedLast24h(db);
  const sentThisWeek = await submittedLast7d(db);
  if (settings.daily_cap > 0 && sentToday >= settings.daily_cap) {
    console.log(`Daily cap reached: ${sentToday}/${settings.daily_cap}. Exiting.`);
    return;
  }
  if (settings.weekly_cap > 0 && sentThisWeek >= settings.weekly_cap) {
    console.log(`Weekly cap reached: ${sentThisWeek}/${settings.weekly_cap}. Exiting.`);
    return;
  }

  const remainingDaily = settings.daily_cap > 0 ? settings.daily_cap - sentToday : Infinity;
  const remainingWeekly = settings.weekly_cap > 0 ? settings.weekly_cap - sentThisWeek : Infinity;
  const max = Math.min(flags.max, remainingDaily, remainingWeekly);

  const ids = (await listReadyIds({ includeAtsNative: flags.includeAtsNative })).slice(0, max);
  console.log(
    `Processing ${ids.length} ready application(s) (auto-submit=${flags.autoSubmit}, ` +
    `daily=${sentToday}/${settings.daily_cap || "∞"}, weekly=${sentThisWeek}/${settings.weekly_cap || "∞"})`,
  );

  const summary: RunSummary = {
    considered: ids.length, submitted: 0, filled_only: 0, failed: 0, reasons: {},
  };
  const startedAt = new Date().toISOString();

  for (const id of ids) {
    // Re-check the kill switch between each app.
    const fresh = await getSettings();
    if (fresh.submission_paused) {
      console.log("Pause flipped mid-run. Exiting.");
      break;
    }
    console.log(`\n--- ${id} ---`);
    const { output } = await spawnAgent(id, flags.autoSubmit);
    const kind = classify(output);
    summary[kind]++;
    if (kind !== "submitted") {
      const m = output.match(/(?:FAILED|reason):\s*(.+)/);
      if (m) summary.reasons[m[1].slice(0, 80)] = (summary.reasons[m[1].slice(0, 80)] ?? 0) + 1;
    }
  }

  const finishedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO routine_runs (routine, started_at, finished_at, ok, stats_json)
          VALUES ('submit', ?, ?, 1, ?)`,
    args: [startedAt, finishedAt, JSON.stringify(summary)],
  });

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
