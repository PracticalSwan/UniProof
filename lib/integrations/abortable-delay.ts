import "server-only";

export async function waitForRetryDelay(
  milliseconds: number,
  signal: AbortSignal | undefined,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<boolean> {
  if (signal?.aborted) return false;

  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<void>((resolve) => {
    onAbort = () => resolve();
    signal?.addEventListener("abort", onAbort, { once: true });
  });

  try {
    const sleepCompleted = (async () => {
      await sleep(milliseconds);
      return true;
    })();
    const result = await Promise.race([
      sleepCompleted,
      abortPromise.then(() => false),
    ]);
    return !signal?.aborted && result !== false;
  } finally {
    if (onAbort !== undefined) {
      signal?.removeEventListener("abort", onAbort);
    }
  }
}
