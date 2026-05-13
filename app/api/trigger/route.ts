import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Triggers a Claude Code routine via Anthropic's API trigger endpoint.
 * Both ANTHROPIC_API_TRIGGER_URL and ANTHROPIC_API_TRIGGER_TOKEN must be set
 * in .env after deploying routines via /schedule.
 */
export async function POST(req: NextRequest) {
  const { routine } = await req.json();
  if (!routine || typeof routine !== "string") {
    return NextResponse.json({ error: "routine required" }, { status: 400 });
  }

  const url = process.env.ANTHROPIC_API_TRIGGER_URL;
  const token = process.env.ANTHROPIC_API_TRIGGER_TOKEN;
  if (!url || !token) {
    return NextResponse.json(
      {
        error:
          "Routine trigger not configured. Deploy routines via /schedule, then set ANTHROPIC_API_TRIGGER_URL + ANTHROPIC_API_TRIGGER_TOKEN in .env",
      },
      { status: 500 }
    );
  }

  const res = await fetch(
    `${url.replace(/\/$/, "")}/routines/${encodeURIComponent(routine)}/trigger`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `trigger failed: ${res.status} ${body}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
