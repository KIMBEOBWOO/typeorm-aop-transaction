import { DiscoveryService } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TransactionModuleOption } from '../interfaces/transaction-module-option.interface';
import { DataSourceMapService } from '../providers/data-source-map.service';
import { TRANSACTION_MODULE_OPTION } from '../symbols/transaciton-module-option.symbol';
import { getMockDiscoveryService } from './mocks/discovery.service.mock';
import { getMockTransactionModuleOption } from './mocks/transaction-module-option.mock';

class TestDataSourceMapService extends DataSourceMapService {
  public override dataSourceMap!: Record<string, DataSource | undefined>;
}

describe('DataSourceMapService', () => {
  let service: TestDataSourceMapService;
  let discoveryService: DiscoveryService;
  let option: TransactionModuleOption;

  beforeEach(async () => {
    const providerList: InstanceWrapper<any>[] = [
      {
        instance: new DataSource({
          type: 'postgres',
          name: 'TEST_DATA_SOURCE_1',
        }),
      } as any,
      {
        instance: { a: 1, b: 2 },
      } as any,
      {
        instance: new DataSource({ type: 'mysql', name: 'TEST_DATA_SOURCE_2' }),
      } as any,
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestDataSourceMapService,
        {
          provide: DiscoveryService,
          useValue: getMockDiscoveryService({
            getProviders: jest.fn().mockReturnValue(providerList),
          }),
        },
        {
          provide: TRANSACTION_MODULE_OPTION,
          useValue: getMockTransactionModuleOption(),
        },
      ],
    }).compile();

    service = module.get<TestDataSourceMapService>(TestDataSourceMapService);
    discoveryService = module.get<DiscoveryService>(DiscoveryService);
    option = module.get<TransactionModuleOption>(TRANSACTION_MODULE_OPTION);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(discoveryService).toBeDefined();
    expect(option).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('DataSource instances registered as providers should be stored in the local variable dataSourceMap', () => {
      service.onModuleInit();

      expect(service.dataSourceMap['TEST_DATA_SOURCE_1']).toBeInstanceOf(
        DataSource,
      );
      expect(service.dataSourceMap['TEST_DATA_SOURCE_2']).toBeInstanceOf(
        DataSource,
      );
    });
  });

  describe('getDataSource', () => {
    it('If connectionName is not undefined, you must import and return the corresponding DataSource instance from the dataSourceMap', () => {
      service.dataSourceMap = {
        TEST_DATA_SOURCE_1: 1,
        TEST_DATA_SOURCE_2: 2,
      } as any;

      const dataSource = service.getDataSource('TEST_DATA_SOURCE_1');

      expect(dataSource).toBe(1);
    });

    it('Returns an Error if connectionName does not have a corresponding DataSource', () => {
      service.dataSourceMap = {};

      expect(() => service.getDataSource('TEST_DATA_SOURCE_1')).toThrowError(
        new Error(`DataSource name "${'TEST_DATA_SOURCE_1'}" is not exists`),
      );
    });

    it('If connectionName is undefined, use defaultConnectionName as the key value', () => {
      service.dataSourceMap = {
        TEST_DATA_SOURCE_1: 1,
        TEST_DATA_SOURCE_2: 2,
        TEST_DEFAULT_CONNECTION_NAME: 3, // should be selected
      } as any;

      const dataSource = service.getDataSource();

      expect(dataSource).toBe(3);
    });
  });
});
