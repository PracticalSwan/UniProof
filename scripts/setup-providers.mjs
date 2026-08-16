import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const envPath = process.env.UNIPROOF_ENV_FILE ?? path.join(projectRoot, ".env.local");
const managedKeys = ["TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY"];
const forceNonInteractive = process.argv.includes("--non-interactive") || process.env.UNIPROOF_NON_INTERACTIVE === "1";

function safeValue(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized === "" || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized;
}

function updateManagedLines(existing, values) {
  const newline = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing === "" ? [] : existing.split(/\r?\n/u);
  const seen = new Set();
  const updated = lines.map((line) => {
    const match = /^([ \t]*)(TAVILY_API_KEY|BRAVE_SEARCH_API_KEY)([ \t]*)=/u.exec(line);
    if (match === null) return line;
    const key = match[2];
    seen.add(key);
    const value = values[key];
    return value !== undefined ? `${match[1]}${key}${match[3]}=${value}` : line;
  });
  for (const key of managedKeys) {
    if (!seen.has(key) && values[key] !== undefined) updated.push(`${key}=${values[key]}`);
  }
  return updated.join(newline).replace(/(?:\r?\n)+$/u, "") + (updated.length > 0 ? newline : "");
}

function interactiveTerminal() {
  return !forceNonInteractive && process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function promptSecret(label) {
  if (!interactiveTerminal()) return Promise.resolve("");

  const stdin = process.stdin;
  const stdout = process.stdout;
  return new Promise((resolve, reject) => {
    let value = "";
    let settled = false;
    const previousRawMode = stdin.isRaw ?? false;

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) stdin.setRawMode(previousRawMode);
      stdin.pause();
    };
    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      stdout.write("\n");
      if (error === undefined) resolve(result);
      else reject(error);
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\r" || character === "\n") {
          finish(value);
        } else if (character === "\u0003") {
          finish(undefined, new Error("prompt cancelled"));
        } else if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (/^[\x20-\x7e]$/u.test(character)) {
          value += character;
          stdout.write("*");
        }
      }
    };

    try {
      stdout.write(label);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onData);
    } catch {
      finish(undefined, new Error("interactive prompt unavailable"));
    }
  });
}

async function collectValues() {
  const values = Object.fromEntries(managedKeys.map((key) => [key, safeValue(process.env[key])]));
  if (!interactiveTerminal()) return values;

  for (const key of managedKeys) {
    if (values[key] !== undefined) continue;
    const entered = await promptSecret(`${key} (hidden input; blank keeps the current value): `);
    values[key] = safeValue(entered);
  }
  return values;
}

async function main() {
  let values;
  try {
    values = await collectValues();
  } catch {
    console.error("Provider setup cancelled; no configuration was changed.");
    process.exitCode = 1;
    return;
  }
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const shouldWrite = managedKeys.some((key) => values[key] !== undefined);
  if (shouldWrite) {
    fs.writeFileSync(envPath, updateManagedLines(existing, values), { encoding: "utf8", mode: 0o600 });
  }
  const configured = managedKeys.filter((key) => values[key] !== undefined || new RegExp(`^\\s*${key}\\s*=\\s*[^\\s#]`, "mu").test(existing));
  console.log(`Provider configuration checked in ${path.basename(envPath)}.`);
  for (const key of managedKeys) console.log(`${key}: ${configured.includes(key) ? "configured" : "not configured"}`);
  console.log(interactiveTerminal()
    ? "Provider keys were collected without echoing values. No connectivity checks were run."
    : "No provider connectivity checks were run and no API-key prompt was requested.");
  console.log("Phase 2D AI mode remains disabled until a later implementation batch.");
}

await main();
