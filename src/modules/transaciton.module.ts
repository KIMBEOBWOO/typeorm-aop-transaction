import { ClassProvider, DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { AlsStore, AlsTransactionDecorator, BaseRepository } from '..';
import { DataSourceMapService } from '../providers/data-source-map.service';
import { TRANSACTION_MODULE_OPTION } from '../symbols/transaciton-module-option.symbol';
import { TransactionLogger } from '../providers/transaction.logger';
import { TransactionModuleOption } from '../interfaces/transaction-module-option.interface';
import { TypeORMTransactionService } from '../providers/transaction.service';
import { AsyncLocalStorage } from 'async_hooks';
import { ALS_SERVICE } from '../symbols/als-service.symbol';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { CUSTOM_REPOSITORY_METADATA } from '../const/custom-repository-metadata';
import { BaseRepositoryConstructor } from '../interfaces/base-repository-constructor.interface';
import { isBaseRepositoryPrototype } from '../utils/is-base-repository-prototype';
import { EntityTarget } from 'typeorm';
import { isTypeORMEntity } from '../utils/is-typeorm-entity';
import { DATA_SOURCE_MAP_SERVICE } from '../symbols/data-source-map.service.symbol';

@Module({
  imports: [DiscoveryModule],
  providers: [
    {
      provide: ALS_SERVICE,
      useValue: new AsyncLocalStorage(),
    },
  ],
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
          provide: DATA_SOURCE_MAP_SERVICE,
          useFactory: (discoveryService: DiscoveryService) => {
            return new DataSourceMapService(discoveryService, options);
          },
          inject: [DiscoveryService],
        },
        {
          provide: TypeORMTransactionService,
          useFactory: (service: DataSourceMapService) => {
            return new TypeORMTransactionService(service);
          },
          inject: [DATA_SOURCE_MAP_SERVICE],
        },
        TransactionLogger,
        AlsTransactionDecorator,
      ],
      exports: [AlsTransactionDecorator, TransactionLogger, ALS_SERVICE],
    };
  }

  static setRepository(
    targetList: (
      | EntityTarget<any>
      | BaseRepositoryConstructor
      | ClassProvider
    )[],
  ): DynamicModule {
    const basicRepositories = targetList.map((target) => {
      // BaseRepository 를 상속한 클래스 타입인 경우
      if (isBaseRepositoryPrototype(target)) {
        const targetEntity = Reflect.getMetadata(
          CUSTOM_REPOSITORY_METADATA.REPOSITORY_TARGET,
          target,
        );

        const repositoryToken = Reflect.getMetadata(
          CUSTOM_REPOSITORY_METADATA.REPOSITORY_TOKEN,
          target,
        );

        return {
          provide: repositoryToken || target,
          useFactory: (alsService: AsyncLocalStorage<AlsStore>) => {
            return new target(targetEntity, alsService);
          },
          inject: [ALS_SERVICE],
        };
      }
      // EntitySchema 타입인 경우
      else if (isTypeORMEntity(target)) {
        const repositoryToken = getRepositoryToken(
          target as EntityClassOrSchema,
        );

        return {
          provide: repositoryToken,
          useFactory: (alsService: AsyncLocalStorage<AlsStore>) => {
            return new BaseRepository(target, alsService);
          },
          inject: [ALS_SERVICE],
        };
      }
      // 예외 처리
      else {
        throw new Error(
          'This property cannot be registered as a Repository through setRepository ' +
            JSON.stringify(target),
        );
      }
    });

    return {
      module: TransactionModule,
      providers: [...basicRepositories],
      exports: [...basicRepositories.map((each) => each.provide)],
    };
  }
}
