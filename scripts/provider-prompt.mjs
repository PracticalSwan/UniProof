export function promptSecret(label, {
  stdin = process.stdin,
  stdout = process.stdout,
  interactive = stdin.isTTY === true && stdout.isTTY === true,
} = {}) {
  if (!interactive) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    let value = "";
    let settled = false;
    const previousRawMode = stdin.isRaw ?? false;

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.removeListener("error", onError);
      stdin.removeListener("end", onEnd);
      try {
        if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(previousRawMode);
      } catch {
        // Terminal restoration is best effort; the prompt is still settled.
      }
      try {
        stdin.pause();
      } catch {
        // Some injected streams do not implement pause().
      }
    };
    const onError = () => finish(undefined, new Error("interactive prompt failed"));
    const onEnd = () => finish(undefined, new Error("interactive prompt ended"));
    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        stdout.write("\n");
      } catch {
        // The terminal may already be closing; do not leak the secret.
      }
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
            try {
              stdout.write("\b \b");
            } catch {
              finish(undefined, new Error("interactive output unavailable"));
            }
          }
        } else if (/^[\x20-\x7e]$/u.test(character)) {
          value += character;
          try {
            stdout.write("*");
          } catch {
            finish(undefined, new Error("interactive output unavailable"));
          }
        }
      }
    };

    try {
      stdout.write(label);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onData);
      stdin.once("error", onError);
      stdin.once("end", onEnd);
    } catch {
      finish(undefined, new Error("interactive prompt unavailable"));
    }
  });
}
