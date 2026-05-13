import "dotenv/config";
import { getDb } from "@/src/db/client";
import { annotateUnclassified } from "@/src/core/ingest/annotate";

async function main() {
  const n = await annotateUnclassified(getDb());
  console.log(`Annotated ${n} jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
