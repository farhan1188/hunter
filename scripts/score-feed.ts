import "dotenv/config";
import { getDb } from "@/src/db/client";
import { getProfile } from "@/src/profile/store";
import { scoreUnscored } from "@/src/core/scoring/persist";

async function main() {
  const profile = await getProfile();
  if (!profile.resume_struct) {
    console.error(
      "No resume uploaded yet — upload one via /profile first."
    );
    process.exit(1);
  }
  const n = await scoreUnscored(getDb(), profile);
  console.log(`Scored ${n} jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
