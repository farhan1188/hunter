import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min cap

export async function POST(req: Request) {
  // Optional { application_id } in the JSON body — when present, the agent
  // targets that specific app instead of picking the next ready one.
  let applicationId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.application_id === "string") applicationId = body.application_id;
  } catch { /* no body is fine */ }

  return new Promise<NextResponse>((resolve) => {
    const agentDir = path.join(process.cwd(), "agent");
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npm.cmd" : "npm";
    const args = ["run", "agent"];
    if (applicationId) args.push("--", `--application-id=${applicationId}`);
    const proc = spawn(cmd, args, {
      cwd: agentDir,
      env: { ...process.env, ...(applicationId ? { APPLICATION_ID: applicationId } : {}) },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, 280_000);

    proc.stdout.on("data", (d) => { stdout += String(d); });
    proc.stderr.on("data", (d) => { stderr += String(d); });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve(NextResponse.json({ ok: false, error: String(err), stdout, stderr }, { status: 500 }));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(NextResponse.json({
        ok: code === 0,
        exit_code: code,
        timed_out: timedOut,
        stdout: stdout.slice(-4000),  // last 4KB
        stderr: stderr.slice(-4000),
      }, { status: code === 0 ? 200 : 500 }));
    });
  });
}
