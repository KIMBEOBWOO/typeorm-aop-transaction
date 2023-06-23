import {
  ConsoleLogger,
  ConsoleLoggerOptions,
  Inject,
  Injectable,
} from '@nestjs/common';
import { TRANSACTION_MODULE_OPTION } from '../symbols/transaciton-module-option.symbol';
import { TransactionModuleOption } from '../interfaces/transaction-module-option.interface';

@Injectable()
export class TransactionLogger extends ConsoleLogger {
  public options: ConsoleLoggerOptions;

  constructor(
    @Inject(TRANSACTION_MODULE_OPTION)
    option: TransactionModuleOption,
  ) {
    super('Transactional', {
      logLevels:
        option?.logging === 'all' ? ['debug'] : [option.logging || 'log'],
    });
  }

  override debug(
    message: string,
    _id?: string,
    connectionName?: string,
    methodName?: string,
    isolationLevel?: string,
    propagation?: string,
  ): void {
    super.debug(
      `${_id}|${connectionName}|${methodName}|${isolationLevel}|${propagation} - ${message}`,
    );
  }
}
