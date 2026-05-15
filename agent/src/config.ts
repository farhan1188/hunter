import "dotenv/config";

export interface AgentConfig {
  cdpUrl: string;
  tempDir: string;
  profileBasics: Record<string, string>;
}

export async function loadConfig(): Promise<AgentConfig> {
  const cdpUrl = process.env.CHROME_CDP_URL ?? "http://localhost:9222";
  const tempDir = process.env.TEMP_DOWNLOAD_DIR ?? "./tmp";

  const profileBasics: Record<string, string> = {
    first_name: process.env.PROFILE_FIRST_NAME ?? "",
    last_name:  process.env.PROFILE_LAST_NAME ?? "",
    email:      process.env.PROFILE_EMAIL ?? "",
    phone:      process.env.PROFILE_PHONE ?? "",
    linkedin:   process.env.PROFILE_LINKEDIN ?? "",
    github:     process.env.PROFILE_GITHUB ?? "",
  };
  return { cdpUrl, tempDir, profileBasics };
}
