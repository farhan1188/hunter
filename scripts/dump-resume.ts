import "dotenv/config";
import { getProfile } from "@/src/profile/store";

async function main() {
  const p = await getProfile();
  console.log(JSON.stringify(p.resume_struct, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
