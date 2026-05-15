# Connecting the Local Agent to your Chrome

The agent uses your existing logged-in Chrome session via the Chrome DevTools
Protocol (CDP). This means LinkedIn/Workday/etc. don't see a fresh Playwright
context — they see your normal browser, with all your cookies and sessions.

## One-time setup (Windows)

1. Quit all Chrome windows. (Right-click the Chrome tray icon → Exit.)

2. Create a new shortcut to Chrome with these flags:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\<you>\AppData\Local\Google\Chrome\User Data"
   ```

   Adjust paths if Chrome is installed somewhere else. Keep `--user-data-dir`
   pointing at your *existing* user profile so your cookies / saved logins are
   reused.

3. Save the shortcut as e.g. "Chrome (Job Hunter)" on your desktop.

4. Launch Chrome via this shortcut from now on when you want to run the agent.

5. Verify: open http://localhost:9222 in another tab. You should see a page
   listing your open tabs with `Webview` and `Page` types.

## When the agent runs

- `npm run agent` connects via `connectOverCDP("http://localhost:9222")`.
- It opens new tabs as needed; does NOT take over your existing tabs.
- It will pause at the final Submit button — never clicks Submit itself.
- You click Submit. Agent detects success or failure and updates the DB.

## If Chrome isn't running with `--remote-debugging-port`

The agent will print:
```
ERROR: Could not connect to Chrome at http://localhost:9222.
Start Chrome via the "Chrome (Job Hunter)" shortcut and try again.
```
