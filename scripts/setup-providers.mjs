import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  hasConfiguredManagedLine,
  managedProviderKeys,
  updateManagedLines,
} from "./provider-env.mjs";
import { promptSecret } from "./provider-prompt.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const envPath = path.join(projectRoot, ".env.local");
const forceNonInteractive = process.argv.includes("--non-interactive") || process.env.UNIPROOF_NON_INTERACTIVE === "1";

function safeValue(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized === "" || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized;
}

function interactiveTerminal() {
  return !forceNonInteractive && process.stdin.isTTY === true && process.stdout.isTTY === true;
}

async function collectValues() {
  const values = Object.fromEntries(managedProviderKeys.map((key) => [key, safeValue(process.env[key])]));
  if (!interactiveTerminal()) return values;

  for (const key of managedProviderKeys) {
    if (values[key] !== undefined) continue;
    const entered = await promptSecret(`${key} (hidden input; blank keeps the current value): `, {
      stdin: process.stdin,
      stdout: process.stdout,
      interactive: true,
    });
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
  const shouldWrite = managedProviderKeys.some((key) => values[key] !== undefined);
  if (shouldWrite) {
    fs.writeFileSync(envPath, updateManagedLines(existing, values), { encoding: "utf8", mode: 0o600 });
  }
  const configured = managedProviderKeys.filter((key) => values[key] !== undefined || hasConfiguredManagedLine(existing, key));
  console.log(`Provider configuration checked in ${path.basename(envPath)}.`);
  for (const key of managedProviderKeys) console.log(`${key}: ${configured.includes(key) ? "configured" : "not configured"}`);
  console.log(interactiveTerminal()
    ? "Provider keys were collected without echoing values. No connectivity checks were run."
    : "No provider connectivity checks were run and no API-key prompt was requested.");
  console.log("Research mode remains unchanged; provider setup does not enable live research automatically.");
}

await main();
