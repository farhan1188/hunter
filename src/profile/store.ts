import { getDb } from "@/src/db/client";
import type { Profile, Preferences, ResumeStruct } from "@/src/core/types";
import { PreferencesSchema } from "@/src/core/schemas";

export async function getProfile(): Promise<Profile> {
  const { rows } = await getDb().execute(
    "SELECT * FROM profile WHERE id = 1"
  );
  const r = rows[0];
  if (!r) throw new Error("profile row missing — migration not applied?");

  const basics = JSON.parse((r.basics_json as string) || "{}");
  const preferences = PreferencesSchema.parse(
    JSON.parse((r.preferences_json as string) || "{}")
  );
  const resume_struct = r.resume_struct_json
    ? (JSON.parse(r.resume_struct_json as string) as ResumeStruct)
    : undefined;

  return {
    resume_file: r.resume_filename
      ? {
          filename: r.resume_filename as string,
          uploaded_at: r.resume_uploaded_at as string,
        }
      : undefined,
    basics,
    resume_struct,
    preferences,
  };
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await getDb().execute({
    sql: "UPDATE profile SET preferences_json = ? WHERE id = 1",
    args: [JSON.stringify(prefs)],
  });
}

export async function saveResume(input: {
  pdfBase64: string;
  filename: string;
  struct: ResumeStruct;
  driveFileId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: `UPDATE profile
          SET resume_pdf_base64 = ?, resume_filename = ?, resume_uploaded_at = ?,
              resume_struct_json = ?, resume_drive_file_id = ?
          WHERE id = 1`,
    args: [
      input.pdfBase64,
      input.filename,
      now,
      JSON.stringify(input.struct),
      input.driveFileId ?? null,
    ],
  });
}

export interface AppSettings {
  daily_cap: number;
  weekly_cap: number;
  score_threshold: number;
  aggressiveness: number;
  token_budget_daily_usd: number;
  dry_run: boolean;
  default_target_timezone: string;
  cadence_floor_minutes: number;
  feed_show_country_specific: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const { rows } = await getDb().execute(
    "SELECT * FROM settings WHERE id = 1"
  );
  const r = rows[0];
  return {
    daily_cap: Number(r.daily_cap),
    weekly_cap: Number(r.weekly_cap),
    score_threshold: Number(r.score_threshold),
    aggressiveness: Number(r.aggressiveness),
    token_budget_daily_usd: Number(r.token_budget_daily_usd),
    dry_run: Number(r.dry_run) === 1,
    default_target_timezone: r.default_target_timezone as string,
    cadence_floor_minutes: Number(r.cadence_floor_minutes),
    feed_show_country_specific: Number(r.feed_show_country_specific) === 1,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await getDb().execute({
    sql: `UPDATE settings SET
      daily_cap=?, weekly_cap=?, score_threshold=?, aggressiveness=?,
      token_budget_daily_usd=?, dry_run=?, default_target_timezone=?,
      cadence_floor_minutes=?, feed_show_country_specific=?
      WHERE id = 1`,
    args: [
      s.daily_cap,
      s.weekly_cap,
      s.score_threshold,
      s.aggressiveness,
      s.token_budget_daily_usd,
      s.dry_run ? 1 : 0,
      s.default_target_timezone,
      s.cadence_floor_minutes,
      s.feed_show_country_specific ? 1 : 0,
    ],
  });
}

export interface AdapterRow {
  name: string;
  enabled: boolean;
  config_json: string;
  last_run_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
}

export async function listAdapters(): Promise<AdapterRow[]> {
  const { rows } = await getDb().execute(
    "SELECT * FROM adapters ORDER BY name"
  );
  return rows.map((r) => ({
    name: r.name as string,
    enabled: Number(r.enabled) === 1,
    config_json: (r.config_json as string) || "{}",
    last_run_at: (r.last_run_at as string | null) ?? null,
    last_error: (r.last_error as string | null) ?? null,
    consecutive_failures: Number(r.consecutive_failures),
  }));
}

export async function updateAdapter(
  name: string,
  patch: { enabled?: boolean; config_json?: string }
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.enabled !== undefined) {
    sets.push("enabled = ?");
    args.push(patch.enabled ? 1 : 0);
  }
  if (patch.config_json !== undefined) {
    sets.push("config_json = ?");
    args.push(patch.config_json);
  }
  if (sets.length === 0) return;
  args.push(name);
  await getDb().execute({
    sql: `UPDATE adapters SET ${sets.join(", ")} WHERE name = ?`,
    args,
  });
}

export async function upsertAdapter(
  name: string,
  enabled: boolean,
  config: object = {}
): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO adapters (name, enabled, config_json) VALUES (?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, config_json = excluded.config_json`,
    args: [name, enabled ? 1 : 0, JSON.stringify(config)],
  });
}
