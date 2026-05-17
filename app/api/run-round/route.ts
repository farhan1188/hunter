import { NextResponse } from "next/server";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { getSettings } from "@/src/profile/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One round can include several Apify calls + Sonnet tailoring + per-app
// browser-driven submissions, each multiple seconds. 15 minutes is comfortable.
export const maxDuration = 900;

// Streams a single autonomous round to the browser as line-delimited NDJSON:
//   {"phase":"ingest","status":"started"}
//   {"phase":"ingest","status":"done","stats":{...}}
//   {"phase":"tailor","status":"started"} ...
//   {"phase":"submit","status":"done","stats":{...}}
//   {"phase":"round","status":"done","summary":{...}}
//
// Body (optional):
//   { rows?: number, titles?: number, locations?: number, max_submits?: number }
export async function POST(req: Request) {
  let body: { rows?: number; titles?: number; locations?: number; max_submits?: number } = {};
  try { body = await req.json(); } catch { /* default empty */ }

  const settings = await getSettings();
  // The orchestrator honors the master pause switch and the user's choice on
  // whether to actually click Submit (default: highlight-only).
  const autoSubmit = settings.autonomous_auto_submit && !settings.submission_paused;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(line: object) {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      }

      async function runStep(
        phase: string,
        cmd: string,
        args: string[],
        opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
      ): Promise<{ ok: boolean; stdout: string }> {
        return new Promise((resolve) => {
          send({ phase, status: "started" });
          const isWindows = process.platform === "win32";
          const proc: ChildProcess = spawn(
            isWindows && cmd === "npm" ? "npm.cmd" : cmd,
            args,
            { cwd: opts.cwd ?? process.cwd(), env: { ...process.env, ...(opts.env ?? {}) }, shell: false },
          );
          let stdout = "";
          proc.stdout?.on("data", (d) => {
            const s = String(d);
            stdout += s;
            // Stream selected progress lines back to the UI.
            for (const line of s.split(/\r?\n/)) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (
                /^Fetched|^Inserted|^Visa-classified|^Scored|^Qualified|^Processing|^\s*\[ready\]|\[quality_review\]|\[errored\]|^Done\.?$|^SUBMITTED|^FAILED/i.test(trimmed)
              ) {
                send({ phase, status: "log", line: trimmed });
              }
            }
          });
          proc.stderr?.on("data", (d) => { stdout += String(d); });
          proc.on("close", (code) => {
            send({ phase, status: code === 0 ? "done" : "failed", exit_code: code });
            resolve({ ok: code === 0, stdout });
          });
        });
      }

      try {
        if (settings.submission_paused) {
          send({ phase: "round", status: "skipped", reason: "submission_paused is on" });
          controller.close();
          return;
        }

        const rows = body.rows ?? 5;
        const titles = body.titles ?? 3;
        const locations = body.locations ?? 3;
        const maxSubmits = body.max_submits ?? 10;

        await runStep("ingest", "npm", [
          "run", "ingest:linkedin", "--",
          `--rows=${rows}`, `--titles=${titles}`, `--locations=${locations}`,
        ]);
        await runStep("tailor", "npm", ["run", "tailor"]);
        const submitArgs = ["run", "submit", "--", `--max=${maxSubmits}`];
        if (autoSubmit) submitArgs.push("--auto-submit");
        submitArgs.push("--include-ats-native");
        await runStep("submit", "npm", submitArgs);

        send({
          phase: "round",
          status: "done",
          auto_submit_was: autoSubmit,
          note: autoSubmit
            ? "Auto-submit was ON. Check the Pipeline → Recent column for what went out."
            : "Auto-submit was OFF (your setting). Forms got filled in Chrome — click Submit yourself for the ones you want sent.",
        });
      } catch (err) {
        send({
          phase: "round",
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
