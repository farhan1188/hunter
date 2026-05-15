import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

export interface ChromeConnection {
  browser: Browser;
  context: BrowserContext;
  newPage(): Promise<Page>;
}

export async function connectToChrome(cdpUrl: string): Promise<ChromeConnection> {
  let browser: Browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (err) {
    throw new Error(
      `Could not connect to Chrome at ${cdpUrl}.\n` +
      `Start Chrome with --remote-debugging-port=9222 (see agent/scripts/setup-chrome-cdp.md).\n` +
      `Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  // connectOverCDP returns an existing browser; the first context is the user's profile.
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error("Chrome connected but no contexts found — open a Chrome window first.");
  }
  const context = contexts[0];
  return {
    browser,
    context,
    newPage: () => context.newPage(),
  };
}
