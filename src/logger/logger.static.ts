import { Logger, PinoLogger } from 'nestjs-pino';

export default class StaticLogger {
  private static logger = new Logger(new PinoLogger({}), {});

  static getLogger(): Logger {
    return this.logger;
  }

  static logAndExit(context: string, err: any, exitCode = 1): void {
    StaticLogger.getLogger().error(
      err?.message ? err.message : JSON.stringify(err),
      err?.stack,
      context,
    );
    process.exit(exitCode);
  }
}
