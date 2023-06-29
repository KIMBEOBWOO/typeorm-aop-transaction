import { Test, TestingModule } from '@nestjs/testing';
import { LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager, QueryRunner } from 'typeorm';
import { BaseRepository } from '../../base.repository';
import { PROPAGATION } from '../../const/propagation';
import { NotRollbackError } from '../../exceptions/not-rollback.error';
import { AlsStore } from '../../interfaces/als-store.interface';
import { TransactionOptions } from '../../interfaces/transaction-option.interface';
import { AlsTransactionDecorator } from '../../providers/als-transaction.decorator';
import { TransactionLogger } from '../../providers/transaction.logger';
import { TypeORMTransactionService } from '../../providers/transaction.service';
import { ALS_SERVICE } from '../../symbols/als-service.symbol';
import { User } from '../fixture/entities/user.entity';
import { getMockAlsService } from '../mocks/als.service.mock';

describe('AlsTransactionDecorator', () => {
  let service: LazyDecorator<any, TransactionOptions>;
  let alsService: AsyncLocalStorage<AlsStore>;
  let transactionService: TypeORMTransactionService;
  let logger: TransactionLogger;
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    /**
     * @NOTE mock object separation required
     */
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      connection: {
        name: 'CREATED_TEST_CONNECTION_NAME',
      },
    } as unknown as QueryRunner;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlsTransactionDecorator,
        {
          provide: ALS_SERVICE,
          useValue: getMockAlsService(),
        },
        {
          provide: TypeORMTransactionService,
          useValue: {
            createConnection: jest.fn().mockReturnValue(queryRunner),
            runInTransaction: jest.fn(),
          },
        },
        {
          provide: TransactionLogger,
          useValue: {
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LazyDecorator<any, TransactionOptions>>(
      AlsTransactionDecorator,
    );
    alsService = module.get<AsyncLocalStorage<AlsStore>>(ALS_SERVICE);
    transactionService = module.get<TypeORMTransactionService>(
      TypeORMTransactionService,
    );
    logger = module.get<TransactionLogger>(TransactionLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(alsService).toBeDefined();
    expect(transactionService).toBeDefined();
    expect(logger).toBeDefined();
  });

  describe('wrap', () => {
    it('Returns an Error if AsyncStorage is undefined', async () => {
      jest.spyOn(alsService, 'getStore').mockReturnValue(undefined);

      await expect(
        async () =>
          await service.wrap({
            metadata: {},
            method: () => true,
            methodName: 'test',
            instance: null as never,
          })(),
      ).rejects.toThrow(
        new Error(
          'AlsTransactionDecorator requires async storage to be initialized. Please check if TransactionMiddleware is registered as a consumer in the root module',
        ),
      );
    });

    it('Returns an Error if propagation option is not supported', async () => {
      jest.spyOn(alsService, 'getStore').mockReturnValue(true as any);

      await expect(
        async () =>
          await service.wrap({
            metadata: {
              propagation: 'NOT_SUPPORTED_PROPAGATION_OPTION' as any,
            },
            method: () => true,
            methodName: 'test',
            instance: null as never,
          })(),
      ).rejects.toThrow(
        new Error(
          'Propagation(NOT_SUPPORTED_PROPAGATION_OPTION) option not supported yet.',
        ),
      );
    });

    describe('When the propagation property is REQUIRED', () => {
      const wrapParam: WrapParams<any, TransactionOptions> = {
        metadata: {
          propagation: PROPAGATION.REQUIRED,
        },
        method: jest.fn(),
        methodName: 'test',
        instance: null as never,
      };
      const args = [1, 2, 3, 4];

      it(`  If the context has a running parent transaction and the propagation property 
            of that transaction is not REQUIRES_NEW, you must participate in the parent transaction`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
          queryRunner: {
            ...queryRunner,
            isTransactionActive: true,
            connection: {
              name: 'STORE_CONNECTION_NAME',
            } as any,
          },
        });
        const debug = jest.spyOn(logger, 'debug');
        const runInTransaction = jest.spyOn(
          transactionService,
          'runInTransaction',
        );

        (await service.wrap(wrapParam))(...args);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'Join Transaction',
          '1997-06-07',
          'STORE_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.REQUIRED,
        );

        expect(runInTransaction).toBeCalledTimes(1);
        expect(runInTransaction).toBeCalledWith(wrapParam.method, args);
      });

      it(`  If the context does not have a query runner, a new transaction must be created`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
        });
        const createConnection = jest.spyOn(
          transactionService,
          'createConnection',
        );
        const debug = jest.spyOn(logger, 'debug');
        const run = jest.spyOn(alsService, 'run');

        (await service.wrap(wrapParam))(...args);

        expect(createConnection).toBeCalledTimes(1);
        expect(createConnection).toBeCalledWith(undefined);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'New Transaction',
          '1997-06-07',
          'CREATED_TEST_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.REQUIRED,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: queryRunner,
            parentPropagtionContext: {
              [PROPAGATION.REQUIRED]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });

      it(`  If the parent transaction is REQUIRES_NEW, 
            throw a NotRollbackError if an error occurs`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {
            [PROPAGATION.REQUIRES_NEW]: true,
          },
          queryRunner: {
            ...queryRunner,
            isTransactionActive: true,
            connection: {
              name: 'STORE_CONNECTION_NAME',
            } as any,
          },
        });
        jest.spyOn(logger, 'debug').mockImplementation(() => {
          throw new Error('TARGET METHOD ERROR');
        });

        await expect(
          async () => await service.wrap(wrapParam)(...args),
        ).rejects.toBeInstanceOf(NotRollbackError);
      });
    });

    describe('When the propagation property is REQUIRES_NEW', () => {
      const wrapParam: WrapParams<any, TransactionOptions> = {
        metadata: {
          propagation: PROPAGATION.REQUIRES_NEW,
        },
        method: jest.fn(),
        methodName: 'test',
        instance: null as never,
      };
      const args = [1, 2, 3, 4];

      it(`  Existing transactions should be placed on hold and transactions initiated
            in the new execution context`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
        });
        const createConnection = jest.spyOn(
          transactionService,
          'createConnection',
        );
        const debug = jest.spyOn(logger, 'debug');
        const run = jest.spyOn(alsService, 'run');

        (await service.wrap(wrapParam))(...args);

        expect(createConnection).toBeCalledTimes(1);
        expect(createConnection).toBeCalledWith(undefined);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'New Transaction',
          '1997-06-07',
          'CREATED_TEST_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.REQUIRES_NEW,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: queryRunner,
            parentPropagtionContext: {
              [PROPAGATION.REQUIRES_NEW]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });
    });

    describe('When the propagation property is NESTED', () => {
      const wrapParam: WrapParams<any, TransactionOptions> = {
        metadata: {
          propagation: PROPAGATION.NESTED,
        },
        method: jest.fn(),
        methodName: 'test',
        instance: null as never,
      };
      const args = [1, 2, 3, 4];

      it(`  If the context has a running parent transaction and the propagation 
            property of that transaction is not REQUIRES_NEW, create nested transaction`, async () => {
        const storeQueryRunner = {
          ...queryRunner,
          isTransactionActive: true,
          connection: {
            name: 'STORE_CONNECTION_NAME',
          } as any,
        };
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
          queryRunner: storeQueryRunner,
        });
        const debug = jest.spyOn(logger, 'debug');
        const run = jest.spyOn(alsService, 'run');

        (await service.wrap(wrapParam))(...args);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'Make savepiont, Wrap Transaction',
          '1997-06-07',
          'STORE_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.NESTED,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: storeQueryRunner,
            parentPropagtionContext: {
              [PROPAGATION.NESTED]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });

      it(`  If the context does not have a query runner, a new transaction must be created`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
        });
        const createConnection = jest.spyOn(
          transactionService,
          'createConnection',
        );
        const debug = jest.spyOn(logger, 'debug');
        const run = jest.spyOn(alsService, 'run');

        (await service.wrap(wrapParam))(...args);

        expect(createConnection).toBeCalledTimes(1);
        expect(createConnection).toBeCalledWith(undefined);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'New Transaction',
          '1997-06-07',
          'CREATED_TEST_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.NESTED,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: queryRunner,
            parentPropagtionContext: {
              [PROPAGATION.NESTED]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });

      it(`  If there is no running querier in the context, an error should be returned if an error occurs`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
        });
        const createConnection = jest.spyOn(
          transactionService,
          'createConnection',
        );
        const debug = jest.spyOn(logger, 'debug');
        const run = jest
          .spyOn(alsService, 'run')
          .mockImplementation(() =>
            Promise.reject(new Error('TARGET METHOD ERROR')),
          );

        await expect(
          async () => await service.wrap(wrapParam)(...args),
          // 해당 에러는 NotRollbackError 이어서는 안된다.
        ).rejects.not.toBeInstanceOf(NotRollbackError);

        expect(createConnection).toBeCalledTimes(1);
        expect(createConnection).toBeCalledWith(undefined);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'New Transaction',
          '1997-06-07',
          'CREATED_TEST_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.NESTED,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: queryRunner,
            parentPropagtionContext: {
              [PROPAGATION.NESTED]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });

      it(`  If you have a running querier in the context, you should return a NotRollBackError if you encounter an error`, async () => {
        const storeQueryRunner = {
          ...queryRunner,
          isTransactionActive: true,
          connection: {
            name: 'STORE_CONNECTION_NAME',
          } as any,
        };
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
          queryRunner: storeQueryRunner,
        });

        const debug = jest.spyOn(logger, 'debug');
        const run = jest
          .spyOn(alsService, 'run')
          .mockImplementation(() =>
            Promise.reject(new Error('TARGET METHOD ERROR')),
          );

        await expect(
          async () => await service.wrap(wrapParam)(...args),
        ).rejects.toBeInstanceOf(NotRollbackError);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'Make savepiont, Wrap Transaction',
          '1997-06-07',
          'STORE_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.NESTED,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: storeQueryRunner,
            parentPropagtionContext: {
              [PROPAGATION.NESTED]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });
    });

    describe('When the propagation property is SUPPORTS', () => {
      const wrapParam: WrapParams<any, TransactionOptions> = {
        metadata: {
          propagation: PROPAGATION.SUPPORTS,
        },
        method: jest.fn(),
        methodName: 'test',
        instance: null as never,
      };
      const args = [1, 2, 3, 4];

      it(`  If the context has a running parent transaction and the propagation property 
            of that transaction is not REQUIRES_NEW, you must participate in the parent transaction`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
          queryRunner: {
            ...queryRunner,
            isTransactionActive: true,
            connection: {
              name: 'STORE_CONNECTION_NAME',
            } as any,
          },
        });
        const debug = jest.spyOn(logger, 'debug');
        const runInTransaction = jest.spyOn(
          transactionService,
          'runInTransaction',
        );

        (await service.wrap(wrapParam))(...args);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'Join Transaction',
          '1997-06-07',
          'STORE_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.SUPPORTS,
        );

        expect(runInTransaction).toBeCalledTimes(1);
        expect(runInTransaction).toBeCalledWith(wrapParam.method, args);
      });

      it(`  If the context does not have a query runner, Run SQL query only.`, async () => {
        jest.spyOn(alsService, 'getStore').mockReturnValue({
          _id: '1997-06-07',
          parentPropagtionContext: {},
        });
        const createConnection = jest.spyOn(
          transactionService,
          'createConnection',
        );
        const debug = jest.spyOn(logger, 'debug');
        const run = jest.spyOn(alsService, 'run');

        (await service.wrap(wrapParam))(...args);

        expect(createConnection).toBeCalledTimes(1);
        expect(createConnection).toBeCalledWith(undefined);

        expect(debug).toBeCalledTimes(1);
        expect(debug).toBeCalledWith(
          'Without Transaction',
          '1997-06-07',
          'CREATED_TEST_CONNECTION_NAME',
          'test',
          'READ COMMITTED',
          PROPAGATION.SUPPORTS,
        );

        expect(run).toBeCalledTimes(1);
        expect(run).toBeCalledWith(
          {
            // 스토어 쿼리러너 세팅
            _id: '1997-06-07',
            queryRunner: queryRunner,
            parentPropagtionContext: {
              [PROPAGATION.SUPPORTS]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
            },
          },
          /**
           * @NOTE Requires more accurate testing of callback delivery
           */
          expect.any(Function),
        );
      });
    });
  });

  describe('setUpBaseRepository', () => {
    const mockEntityManager: EntityManager = {
      getRepository: jest.fn(),
    } as any;

    beforeEach(() => jest.clearAllMocks());

    it(`  If the entity manager calls the manager getter of the repository rather than the undefined, 
          the repository manager of the target entity class must be returned.`, async () => {
      class TestRepository extends BaseRepository<User> {
        constructor() {
          super(User, alsService);
          AlsTransactionDecorator.setUpBaseRepository(
            this,
            User,
            alsService,
            mockEntityManager,
          );
        }
      }

      const testRepository: TestRepository = new TestRepository();

      const getRepository = jest
        .spyOn(mockEntityManager, 'getRepository')
        .mockReturnValue({
          manager: true,
        } as never);

      testRepository.manager;

      expect(getRepository).toBeCalledTimes(1);
      expect(getRepository).toBeCalledWith(User);
    });

    it(`  If the entity manager is undefined and calls the manager getter of Repository, 
          you must return the repository manager of targetEntity using the queryRunner stored in the alsStore`, async () => {
      class TestRepository extends BaseRepository<User> {
        constructor() {
          super(User, alsService);
          AlsTransactionDecorator.setUpBaseRepository(this, User, alsService);
        }
      }

      const testRepository: TestRepository = new TestRepository();

      const getStore = jest.spyOn(alsService, 'getStore').mockReturnValue({
        queryRunner: {
          manager: mockEntityManager,
        },
      } as any);
      const getRepository = jest
        .spyOn(mockEntityManager, 'getRepository')
        .mockReturnValue({
          manager: true,
        } as never);

      testRepository.manager;

      expect(getStore).toBeCalledTimes(1);
      expect(getStore).toBeCalledWith();

      expect(getRepository).toBeCalledTimes(1);
      expect(getRepository).toBeCalledWith(User);
    });

    it(`  If the queryRunner of the alsStore does not exist when the entityManager is undefined 
          and calls the manager getter of the Repository, an error should be returned.`, async () => {
      class TestRepository extends BaseRepository<User> {
        constructor() {
          super(User, alsService);
          AlsTransactionDecorator.setUpBaseRepository(this, User, alsService);
        }
      }

      const testRepository: TestRepository = new TestRepository();

      jest.spyOn(alsService, 'getStore').mockReturnValue(undefined);

      try {
        testRepository.manager;
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(
            'QueryRunner does not exist. @Transactional Access to the database running internally should only be via the Repository method that inherits the Base Repository.',
          ),
        );
      }
    });
  });
});
