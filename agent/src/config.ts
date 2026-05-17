import "dotenv/config";

export interface AgentConfig {
  cdpUrl: string;
  tempDir: string;
  profileBasics: Record<string, string>;
}

export async function loadConfig(): Promise<AgentConfig> {
  const cdpUrl = process.env.CHROME_CDP_URL ?? "http://localhost:9222";
  const tempDir = process.env.TEMP_DOWNLOAD_DIR ?? "./tmp";

  const first = process.env.PROFILE_FIRST_NAME ?? "";
  const last = process.env.PROFILE_LAST_NAME ?? "";
  const profileBasics: Record<string, string> = {
    first_name: first,
    last_name:  last,
    full_name:  [first, last].filter(Boolean).join(" "),
    email:      process.env.PROFILE_EMAIL ?? "",
    phone:      process.env.PROFILE_PHONE ?? "",
    location:   process.env.PROFILE_LOCATION ?? "",
    linkedin:   process.env.PROFILE_LINKEDIN ?? "",
    github:     process.env.PROFILE_GITHUB ?? "",
    current_company: process.env.PROFILE_CURRENT_COMPANY ?? "",
    current_title:   process.env.PROFILE_CURRENT_TITLE ?? "",
    years_experience: process.env.PROFILE_YEARS_EXPERIENCE ?? "",
  };
  return { cdpUrl, tempDir, profileBasics };
}
