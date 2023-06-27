import { AbstractLogger, LogLevel, LogMessage } from 'typeorm';

export const mockQueryLogger = {
  info: jest.fn(),
} as any;

export class TypeORMLogger extends AbstractLogger {
  protected writeLog(
    level: LogLevel,
    message: string | number | LogMessage | (string | number | LogMessage)[],
  ): void {
    const messages = this.prepareLogMessages(message, {
      highlightSql: false,
    });

    for (const message of messages) {
      switch (message.type ?? level) {
        case 'query':
          mockQueryLogger.info(message.message);
          break;
      }
    }
  }
}
