import { DynamicModule, Global, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { AlsTransactionDecorator } from './als-transaction.decorator';
import { AlsModule } from './als.module';
import { DataSourceMapService } from './data-source-map.service';
import { TransactionModuleOption } from './transaction-module-option.interface';
import { TypeORMTransactionService } from './transaction.service';

@Module({
  imports: [DiscoveryModule, AopModule, AlsModule],
})
export class TransactionModule {
  static regist(options: TransactionModuleOption): DynamicModule {
    return {
      module: TransactionModule,
      providers: [
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
        AlsTransactionDecorator,
      ],
      exports: [AlsTransactionDecorator, AopModule, AlsModule],
    };
  }
}
