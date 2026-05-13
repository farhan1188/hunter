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
  | { type: "adapter_upsert"; name: string; enabled: boolean; config: object };

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
  }
  return NextResponse.json({ ok: true });
}
