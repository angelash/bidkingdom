import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type ServerLogLevel = 'info' | 'warn' | 'error';

export function appendServerLog(level: ServerLogLevel, event: string, context: Record<string, unknown> = {}): void {
  const logFile = process.env.BITKINGDOM_LOG_FILE?.trim();
  if (!logFile) {
    return;
  }

  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(
      logFile,
      `${stringifyJsonLine({
        time: new Date().toISOString(),
        level,
        event,
        ...context
      })}\n`,
      'utf8'
    );
  } catch {
    // Logging must never break gameplay.
  }
}

function stringifyJsonLine(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, entry) => {
    if (entry instanceof Error) {
      return {
        name: entry.name,
        message: entry.message,
        stack: entry.stack
      };
    }
    if (entry && typeof entry === 'object') {
      if (seen.has(entry)) {
        return '[Circular]';
      }
      seen.add(entry);
    }
    return entry;
  }) ?? '{}';
}
