import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { TransactionModuleOption } from '../interfaces/transaction-module-option.interface';
import { TRANSACTION_MODULE_OPTION } from '../symbols/transaciton-module-option.symbol';

@Injectable()
export class DataSourceMapService implements OnModuleInit {
  // DataSource key-value store
  protected dataSourceMap: Record<string, DataSource | undefined>;

  constructor(
    private readonly discoveryService: DiscoveryService,
    @Inject(TRANSACTION_MODULE_OPTION)
    private readonly option: TransactionModuleOption,
  ) {
    this.dataSourceMap = {};
  }

  public onModuleInit() {
    // find DataSource provider
    const dataSourceProviders = this.discoveryService.getProviders().filter(
      (provider) =>
        // TypeORM DataSource 인스턴스 필터링
        provider.instance instanceof DataSource,
    );

    // init dataSourceMap
    this.dataSourceMap = dataSourceProviders.reduce((prev, curr) => {
      prev[curr.instance.name] = curr.instance;

      return prev;
    }, {} as Record<string, DataSource | undefined>);
  }

  /**
   * Connection Name 에 해당하는 DataSource Getter
   * @param connectionName (optional) TypeORM 모듈에서 설정한 데이터베이스 연결 이름, undefined 입력시 default Connection Name 사용
   * @returns DataSource
   */
  public getDataSource(connectionName?: string): DataSource {
    /**
     * @NOTE instance name 규칙 확인 필요
     */
    const dataSource: DataSource | undefined =
      this.dataSourceMap[connectionName || this.option.defaultConnectionName];

    if (dataSource === undefined) {
      throw new Error(`DataSource name "${connectionName}" is not exists`);
    }

    return dataSource;
  }
}
