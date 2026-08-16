type PromptInput = {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode(value: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  once(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
};

type PromptOutput = {
  write(chunk: string): unknown;
};

export function promptSecret(
  label: string,
  options?: {
    stdin?: PromptInput;
    stdout?: PromptOutput;
    interactive?: boolean;
  },
): Promise<string>;
