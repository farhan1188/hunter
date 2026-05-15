import { NextRequest, NextResponse } from "next/server";
import {
  saveSettings,
  upsertAdapter,
  updateAdapter,
  type AppSettings,
} from "@/src/profile/store";

export const runtime = "nodejs";

type Body =
  | { type: "settings"; data: AppSettings }
  | {
      type: "adapter";
      name: string;
      enabled?: boolean;
      config_json?: string;
    }
  | { type: "adapter_upsert"; name: string; enabled: boolean; config: object }
  | {
      type: "adapter_dial";
      name: string;
      submit_mode?: "off" | "click_to_send" | "auto_submit";
      score_threshold?: number | null;
      daily_cap?: number | null;
    };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  if (body.type === "settings") {
    await saveSettings(body.data);
  } else if (body.type === "adapter") {
    await updateAdapter(body.name, {
      enabled: body.enabled,
      config_json: body.config_json,
    });
  } else if (body.type === "adapter_upsert") {
    await upsertAdapter(body.name, body.enabled, body.config);
  } else if (body.type === "adapter_dial") {
    await updateAdapter(body.name, {
      submit_mode: body.submit_mode,
      score_threshold: body.score_threshold,
      daily_cap: body.daily_cap,
    });
  }
  return NextResponse.json({ ok: true });
}
