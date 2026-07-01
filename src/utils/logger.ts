export class Logger {
  info(message: string, context?: unknown): void {
    this.write("info", message, context);
  }

  warn(message: string, context?: unknown): void {
    this.write("warn", message, context);
  }

  error(message: string, context?: unknown): void {
    this.write("error", message, context);
  }

  private write(level: "info" | "warn" | "error", message: string, context?: unknown): void {
    const payload = {
      level,
      message,
      context,
      ts: new Date().toISOString(),
    };

    console[level](JSON.stringify(payload));
  }
}

export const logger = new Logger();
