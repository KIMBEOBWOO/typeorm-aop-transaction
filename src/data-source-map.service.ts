import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { DataSource } from 'typeorm';

@Injectable()
export class DataSourceMapService implements OnModuleInit {
  // DataSource key-value store
  private dataSourceMap!: Record<string, DataSource | undefined>;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly defaultConnectionName: string,
  ) {}

  public onModuleInit() {
    // find DataSource provider
    const dataSourceProviders = this.discoveryService
      .getProviders()
      .filter(
        (provider) =>
          // TypeORM DataSource 인스턴스 필터링
          provider.instance instanceof DataSource,
      )
      .map((provider) => provider.instance);

    // init dataSourceMap
    this.dataSourceMap = dataSourceProviders.reduce((prev, curr) => {
      prev[curr.name] = curr;

      return prev;
    }, {});
  }

  /**
   * Connection Name 에 해당하는 DataSource Getter
   * @param connectionName (optional) TypeORM 모듈에서 설정한 데이터베이스 연결 이름, undefined 입력시 default Connection Name 사용
   * @returns DataSource
   */
  public getDataSource(connectionName?: string): DataSource {
    const dataSource: DataSource | undefined =
      this.dataSourceMap[connectionName || this.defaultConnectionName];

    if (dataSource === undefined) {
      throw new Error(`DataSource name "${connectionName}" is not exists`);
    }

    return dataSource;
  }
}
