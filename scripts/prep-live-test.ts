// Flip the system into "live submit" mode but with tight caps for a test run.
import "dotenv/config";
import { getDb } from "@/src/db/client";
import { getSettings, saveSettings } from "@/src/profile/store";

async function main() {
  const before = await getSettings();
  console.log("BEFORE:", {
    submission_paused: before.submission_paused,
    autonomous_auto_submit: before.autonomous_auto_submit,
    daily_cap: before.daily_cap,
    weekly_cap: before.weekly_cap,
  });
  await saveSettings({
    ...before,
    submission_paused: false,
    autonomous_auto_submit: true,
    daily_cap: 3,    // tight cap for the live test
    weekly_cap: 5,
  });
  const after = await getSettings();
  console.log("AFTER:", {
    submission_paused: after.submission_paused,
    autonomous_auto_submit: after.autonomous_auto_submit,
    daily_cap: after.daily_cap,
    weekly_cap: after.weekly_cap,
  });
  void getDb;
}
main().catch((e) => { console.error(e); process.exit(1); });
