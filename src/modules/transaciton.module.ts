import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { AlsTransactionDecorator } from '..';
import { AlsModule } from './als.module';
import { DataSourceMapService } from '../providers/data-source-map.service';
import { TRANSACTION_MODULE_OPTION } from '../symbols/transaciton-module-option.symbol';
import { TransactionLogger } from '../providers/transaction.logger';
import { TransactionModuleOption } from '../interfaces/transaction-module-option.interface';
import { TypeORMTransactionService } from '../providers/transaction.service';

@Module({
  imports: [DiscoveryModule, AlsModule],
})
export class TransactionModule {
  static regist(options: TransactionModuleOption): DynamicModule {
    return {
      module: TransactionModule,
      providers: [
        {
          provide: TRANSACTION_MODULE_OPTION,
          useValue: options,
        },
        {
          provide: DataSourceMapService,
          useFactory: (discoveryService: DiscoveryService) => {
            return new DataSourceMapService(
              discoveryService,
              options.defaultConnectionName,
            );
          },
          inject: [DiscoveryService],
        },
        {
          provide: TypeORMTransactionService,
          useFactory: (service: DataSourceMapService) => {
            return new TypeORMTransactionService(service);
          },
          inject: [DataSourceMapService],
        },
        TransactionLogger,
        AlsTransactionDecorator,
      ],
      exports: [AlsTransactionDecorator, TransactionLogger],
    };
  }
}
