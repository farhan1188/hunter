import { loadConfig } from "./config.js";
import { getAgentDb } from "./state.js";
import { runOneApplication } from "./submit-runner.js";

async function main() {
  const cfg = await loadConfig();
  const db = getAgentDb();
  console.log("Connecting to Chrome at", cfg.cdpUrl);
  const result = await runOneApplication({
    cdpUrl: cfg.cdpUrl,
    db,
    profileBasics: cfg.profileBasics,
  });
  console.log("---");
  console.log(result.message);
  if (result.application_id) {
    console.log(`Application id: ${result.application_id}`);
  }
  console.log("---");
  console.log("Done. (Agent does not auto-close Chrome. Review the filled form, " +
              "click Submit yourself, then mark submitted via Hub UI.)");
  process.exit(result.result?.ok === false ? 1 : 0);
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(2);
});
