# Connecting the Local Agent to your Chrome

The agent uses Chrome via the Chrome DevTools Protocol (CDP). Chrome's security model
(since 2024) requires CDP to use a **dedicated profile directory** — not your default
Chrome profile. This is actually convenient: the agent gets its own clean Chrome with
no extensions (so ad-blockers / privacy tools don't break job forms), and your regular
Chrome stays untouched.

You'll sign into LinkedIn / Workday / etc *once* in this dedicated Chrome — after that,
the cookies persist in the profile directory.

## One-time setup (Windows)

1. Create the profile directory (any path you control; this is the recommended default):

   ```powershell
   New-Item -ItemType Directory -Path "C:\Users\$env:USERNAME\chrome-cdp-profile" -Force
   ```

2. Create a new shortcut to Chrome with these flags. **The path must be quoted; the
   flags must NOT be inside the quotes.**

   Target field of the shortcut:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\<you>\chrome-cdp-profile"
   ```

   Replace `<you>` with your Windows username.

3. Save the shortcut as e.g. **"Chrome (Job Hunter)"** on your desktop.

4. Launch Chrome via this shortcut whenever you want to run the agent. The first time
   you do, sign into LinkedIn / Workday / whatever sites the agent will need.

5. Verify: open http://localhost:9222 in any tab of that Chrome. You should see a
   handshake JSON like `{ "Browser": "Chrome/...", "webSocketDebuggerUrl": "..." }`.

## Launching from PowerShell (instead of the shortcut)

PowerShell needs the call operator `&` before a quoted command path, otherwise it
parses the path as a string literal and chokes on the flags:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\$env:USERNAME\chrome-cdp-profile"
```

Or via `Start-Process` (spawns and detaches):

```powershell
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=C:\Users\$env:USERNAME\chrome-cdp-profile"
)
```

## When the agent runs

- `npm run agent` connects via `connectOverCDP("http://localhost:9222")`.
- It opens new tabs as needed; does NOT take over your existing tabs.
- It will pause at the final Submit button — never clicks Submit itself.
- You click Submit. Agent detects success or failure and updates the DB.

## Common gotchas

**"--remote-debugging-port silently ignored":** if you point `--user-data-dir` at your
*default* Chrome profile (`...\AppData\Local\Google\Chrome\User Data`), Chrome drops
the debug flag for security reasons. You must use a separate directory.

**"port 9222 not responding":** an existing Chrome process (even a background updater
or extension host) may be holding the profile. Fully quit Chrome before launching the
job-hunter shortcut:

```powershell
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
```

**"PowerShell parser error on --remote-debugging-port=9222":** you typed the command
without the `&` call operator. See "Launching from PowerShell" above.

## If Chrome isn't running with `--remote-debugging-port`

The agent will print:
```
ERROR: Could not connect to Chrome at http://localhost:9222.
Start Chrome via the "Chrome (Job Hunter)" shortcut and try again.
```
