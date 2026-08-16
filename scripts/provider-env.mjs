export const managedProviderKeys = [
  "TAVILY_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
];

const managedKeyPattern = /^([ \t]*)(TAVILY_API_KEY|BRAVE_SEARCH_API_KEY|GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY)([ \t]*)=/u;

export function updateManagedLines(existing, values) {
  const newline = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing === "" ? [] : existing.split(/\r?\n/u);
  const seen = new Set();
  const updated = lines.map((line) => {
    const match = managedKeyPattern.exec(line);
    if (match === null) return line;
    const key = match[2];
    seen.add(key);
    const value = values[key];
    return value !== undefined ? `${match[1]}${key}${match[3]}=${value}` : line;
  });
  const missing = managedProviderKeys.filter((key) => !seen.has(key) && values[key] !== undefined);
  if (missing.length > 0) {
    // Keep all unrelated content and blank lines. Remove only the synthetic
    // split entry for the final line terminator while appending managed keys,
    // then restore the original style and one terminal terminator.
    if (updated.at(-1) === "") updated.pop();
    for (const key of missing) updated.push(`${key}=${values[key]}`);
    return updated.join(newline) + newline;
  }
  return updated.join(newline);
}

export function hasConfiguredManagedLine(existing, key) {
  for (const line of existing.split(/\r?\n/u)) {
    const match = managedKeyPattern.exec(line);
    if (match?.[2] !== key) continue;
    const value = line.slice(match[0].length).trim();
    if (value !== "" && !value.startsWith("#")) return true;
  }
  return false;
}
