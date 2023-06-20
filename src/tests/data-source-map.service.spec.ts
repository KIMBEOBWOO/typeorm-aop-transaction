import { DiscoveryService } from '@nestjs/core';
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestDataSourceMapService,
        {
          provide: DiscoveryService,
          useValue: getMockDiscoveryService(),
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
      jest.spyOn(discoveryService, 'getProviders').mockReturnValue([]);

      expect(service.dataSourceMap).toStrictEqual({});
    });
  });

  describe('getDataSource', () => {
    //
  });
});
