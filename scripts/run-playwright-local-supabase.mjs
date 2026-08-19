import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function parseEnvOutput(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (match === null) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

const comspec = process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe";
const supabaseCandidates = process.platform === "win32"
  ? [
      path.join(path.dirname(process.execPath), "supabase.cmd"),
      "C:\\nvm4w\\nodejs\\supabase.cmd",
    ]
  : [];
const supabasePath = supabaseCandidates.find((candidate) => existsSync(candidate));
const supabaseCommand = process.platform === "win32"
  ? supabasePath === undefined ? null : `${supabasePath} status -o env`
  : "supabase status -o env";
const status = process.platform === "win32"
  ? spawnSync(comspec, ["/d", "/s", "/c", supabaseCommand], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
  : spawnSync("supabase", ["status", "-o", "env"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });

if (status.status !== 0) {
  console.error("Local Supabase status could not be read. Start the local Supabase stack before running authenticated Playwright tests.");
  process.exit(status.status ?? 1);
}

const local = parseEnvOutput(status.stdout);
const apiUrl = local.get("API_URL");
const publishableKey = local.get("PUBLISHABLE_KEY") ?? local.get("ANON_KEY");
if (apiUrl === undefined || publishableKey === undefined) {
  console.error("Local Supabase status did not provide the public API URL/key required by the authenticated browser harness.");
  process.exit(1);
}

const testEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  UNIPROOF_E2E_LOCAL_SUPABASE: "1",
};

const playwrightCli = path.join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
const args = [playwrightCli, "test", ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  env: testEnv,
  stdio: "inherit",
  windowsHide: true,
});

process.exit(result.status ?? 1);
