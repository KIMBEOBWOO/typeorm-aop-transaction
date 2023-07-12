import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { DataSourceMapService } from '../../providers/data-source-map.service';
import { TypeORMTransactionService } from '../../providers/transaction.service';
import { DATA_SOURCE_MAP_SERVICE } from '../../symbols/data-source-map.service.symbol';

describe('TypeORMTransactionService', () => {
  let service: TypeORMTransactionService;
  let dataSourceMapService: DataSourceMapService;
  let mockQueryRunner: QueryRunner;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DATA_SOURCE_MAP_SERVICE,
          useValue: {
            getDataSource: jest.fn(),
          },
        },
        TypeORMTransactionService,
      ],
    }).compile();

    service = module.get<TypeORMTransactionService>(TypeORMTransactionService);
    dataSourceMapService = module.get<DataSourceMapService>(
      DATA_SOURCE_MAP_SERVICE,
    );

    /**
     * @NOTE mock object separation required
     */
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    } as unknown as QueryRunner;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(dataSourceMapService).toBeDefined();
  });

  describe('createConnection', () => {
    const connectionName = 'test connection name';
    const mockDataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    it('QueryRunner must be returned via dataSource corresponding to connectionName.', () => {
      const getDataSource = jest
        .spyOn(dataSourceMapService, 'getDataSource')
        .mockReturnValue(mockDataSource);
      const createQueryRunner = jest.spyOn(mockDataSource, 'createQueryRunner');

      service.createConnection(connectionName);

      expect(getDataSource).toBeCalledTimes(1);
      expect(getDataSource).toBeCalledWith(connectionName);

      expect(createQueryRunner).toBeCalledTimes(1);
      expect(createQueryRunner).toBeCalledWith();
    });
  });

  describe('runInTransaction', () => {
    const method = (...param: any[]) => param;
    const param = [1, 2, 3, 4];

    it('It should return the result of executing the function with the input function and parameters', async () => {
      const result = await service.runInTransaction(method, param);

      expect(result).toStrictEqual([1, 2, 3, 4]);
    });
  });

  describe('wrapByTransaction', () => {
    const method = (...param: any[]) =>
      new Promise((resolve) => resolve(param));
    const methodWithError = (error: Error) =>
      new Promise(() => {
        throw error;
      });

    const param = [1, 2, 3, 4];

    const isolationLevel: IsolationLevel = 'READ COMMITTED';

    it('If the target method does not return an error, the transaction must be committed, released and return target method result', async () => {
      const connect = jest.spyOn(mockQueryRunner, 'connect');
      const startTransaction = jest.spyOn(mockQueryRunner, 'startTransaction');
      const commitTransaction = jest.spyOn(
        mockQueryRunner,
        'commitTransaction',
      );
      const rollbackTransaction = jest.spyOn(
        mockQueryRunner,
        'rollbackTransaction',
      );

      const result = await service.wrapByTransaction(
        method,
        param,
        mockQueryRunner,
        isolationLevel,
      );

      expect(result).toStrictEqual([1, 2, 3, 4]);

      expect(connect).toBeCalledTimes(1);

      expect(startTransaction).toBeCalledTimes(1);
      expect(startTransaction).toBeCalledWith(isolationLevel);

      expect(commitTransaction).toBeCalledTimes(1);
      expect(rollbackTransaction).toBeCalledTimes(0);
    });

    it('Commit the transaction if the target method returns a NotRollbackError error', async () => {
      const connect = jest.spyOn(mockQueryRunner, 'connect');
      const startTransaction = jest.spyOn(mockQueryRunner, 'startTransaction');
      const commitTransaction = jest.spyOn(
        mockQueryRunner,
        'commitTransaction',
      );
      const rollbackTransaction = jest.spyOn(
        mockQueryRunner,
        'rollbackTransaction',
      );

      const result = () =>
        service.wrapByTransaction(
          methodWithError,
          [new Error('TEST ERROR')],
          mockQueryRunner,
          isolationLevel,
        );

      await expect(async () => await result()).rejects.toThrow(
        new Error('TEST ERROR'),
      );

      expect(connect).toBeCalledTimes(1);

      expect(startTransaction).toBeCalledTimes(1);
      expect(startTransaction).toBeCalledWith(isolationLevel);

      expect(commitTransaction).toBeCalledTimes(0);
      expect(rollbackTransaction).toBeCalledTimes(1);
    });

    it('If the target method returns an error other than NotRollbackError, rollback the transaction', async () => {
      const connect = jest.spyOn(mockQueryRunner, 'connect');
      const startTransaction = jest.spyOn(mockQueryRunner, 'startTransaction');
      const commitTransaction = jest.spyOn(
        mockQueryRunner,
        'commitTransaction',
      );
      const rollbackTransaction = jest.spyOn(
        mockQueryRunner,
        'rollbackTransaction',
      );

      const NotRollbackError = new Error('TEST ERROR');
      (NotRollbackError as any)._not_rollback = true;

      const result = () =>
        service.wrapByTransaction(
          methodWithError,
          [NotRollbackError],
          mockQueryRunner,
          isolationLevel,
        );

      await expect(async () => await result()).rejects.toThrow(
        new Error('TEST ERROR'),
      );

      expect(connect).toBeCalledTimes(1);

      expect(startTransaction).toBeCalledTimes(1);
      expect(startTransaction).toBeCalledWith(isolationLevel);

      expect(commitTransaction).toBeCalledTimes(1);
      expect(rollbackTransaction).toBeCalledTimes(0);
    });

    it('If the isNested option is false, do not release it', async () => {
      const release = jest.spyOn(mockQueryRunner, 'release');

      await service.wrapByTransaction(
        method,
        param,
        mockQueryRunner,
        isolationLevel,
        true,
      );

      expect(release).toBeCalledTimes(0);
    });

    it('If the isNested option is true, do release it', async () => {
      const release = jest.spyOn(mockQueryRunner, 'release');

      await service.wrapByTransaction(
        method,
        param,
        mockQueryRunner,
        isolationLevel,
        false,
      );

      expect(release).toBeCalledTimes(1);
    });
  });
});
