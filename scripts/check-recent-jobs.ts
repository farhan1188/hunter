import "dotenv/config";
import { getProfile } from "@/src/profile/store";

async function main() {
  const p = await getProfile();
  console.log("basics:", JSON.stringify(p.basics, null, 2));
  console.log("resume_uploaded_at:", (p as any).resume_uploaded_at ?? "n/a");
  console.log("resume_struct present:", !!p.resume_struct);
}
main().catch((e) => { console.error(e); process.exit(1); });
