export type OutputChannelLike = {
  appendLine(value: string): void;
  show?(preserveFocus?: boolean): void;
};

let outputChannel: OutputChannelLike | null = null;

export function setOutputChannel(channel: OutputChannelLike | null): void {
  outputChannel = channel;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as any).code;
    return code ? `${error.message} (code: ${String(code)})` : error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function logToOutput(message: string): void {
  outputChannel?.appendLine(message);
}

export function logWarnToOutput(message: string, error?: unknown): void {
  const line = error ? `${message}\n${formatError(error)}` : message;
  outputChannel?.appendLine(line);
  // Make warnings discoverable: reveal the output channel without stealing focus.
  outputChannel?.show?.(true);
}
