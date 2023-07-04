import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { TRANSACTION_MODULE_OPTION } from '../symbols/transaciton-module-option.symbol';
import { TransactionModuleOption } from '../interfaces/transaction-module-option.interface';

@Injectable()
export class TransactionLogger extends ConsoleLogger {
  constructor(
    @Inject(TRANSACTION_MODULE_OPTION)
    option: TransactionModuleOption,
  ) {
    super('Transactional');
    this.setLogLevels(
      option.logging === 'all' ? ['debug'] : [option.logging || 'log'],
    );
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
