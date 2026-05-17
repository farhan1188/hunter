import { loadConfig } from "./config.js";
import { getAgentDb } from "./state.js";
import { runOneApplication } from "./submit-runner.js";

async function main() {
  const cfg = await loadConfig();
  const db = getAgentDb();
  // Accept --application-id=<id> or APPLICATION_ID env var so the Hub can
  // target a specific app rather than always picking the next one.
  const arg = process.argv.find((a) => a.startsWith("--application-id="));
  const applicationId = arg ? arg.split("=")[1] : process.env.APPLICATION_ID;
  console.log("Connecting to Chrome at", cfg.cdpUrl);
  if (applicationId) console.log("Targeting application:", applicationId);
  const result = await runOneApplication({
    cdpUrl: cfg.cdpUrl,
    db,
    profileBasics: cfg.profileBasics,
    applicationId,
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
