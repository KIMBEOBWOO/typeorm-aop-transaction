import { FactoryProvider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomTransactionRepository } from '../../decorators/custom-transaction-repository.decorator';
import { TransactionModuleOption } from '../../interfaces/transaction-module-option.interface';
import { TransactionModule } from '../../modules/transaciton.module';
import { ALS_SERVICE } from '../../symbols/als-service.symbol';
import { TRANSACTION_MODULE_OPTION } from '../../symbols/transaciton-module-option.symbol';
import * as RepositoryUtil from '../../utils/is-base-repository-prototype';
import { User } from '../fixture/entities/user.entity';
import { UserV1Service } from '../fixture/services/user.v1.service';

describe('TransactionModule', () => {
  beforeEach(() => jest.restoreAllMocks());

  describe('regist', () => {
    it('If no name is given, TRANSACTION_MODULE_OPTION must be registered as a value provider through default connection name.', async () => {
      const module = await Test.createTestingModule({
        imports: [TransactionModule.regist()],
      }).compile();

      const moduleOption = module.get<TransactionModuleOption>(
        TRANSACTION_MODULE_OPTION,
      );

      expect(moduleOption).toStrictEqual({
        logging: undefined,
        defaultConnectionName: 'default',
      });
    });

    it('If given a name, TRANSACTION_MODULE_OPTION must be registered as a value provider through its connection name.', async () => {
      const module = await Test.createTestingModule({
        imports: [
          TransactionModule.regist({
            defaultConnectionName: 'TEST',
          }),
        ],
      }).compile();

      const moduleOption = module.get<TransactionModuleOption>(
        TRANSACTION_MODULE_OPTION,
      );

      expect(moduleOption).toStrictEqual({
        logging: undefined,
        defaultConnectionName: 'TEST',
      });
    });
  });

  describe('setRepository', () => {
    it('In the case of a Custom Repository class that inherits the Base Repository, a useFactory that injects the Transaction Repository through metadata applied with the Custom Transaction Repository decoder must be configured.', async () => {
      @CustomTransactionRepository(User, 'Test Repository Token')
      class TestRepository {}

      jest
        .spyOn(RepositoryUtil, 'isBaseRepositoryPrototype')
        .mockReturnValue(true);

      const dynamicModule = TransactionModule.setRepository([TestRepository]);

      expect(dynamicModule.providers).toStrictEqual([
        {
          provide: 'Test Repository Token',
          useFactory: expect.any(Function),
          inject: [ALS_SERVICE],
        },
      ]);
      expect(dynamicModule.exports).toStrictEqual(['Test Repository Token']);
      expect(
        (dynamicModule.providers?.[0] as FactoryProvider).useFactory(),
      ).toStrictEqual(new TestRepository());
    });

    it('In the case of a Custom Repository class that inherits the Base Repository, a useFactory that injects the Transaction Repository through metadata applied with the Custom Transaction Repository decoder must be configured. (Without repository token)', async () => {
      @CustomTransactionRepository(User)
      class TestRepository {}

      jest
        .spyOn(RepositoryUtil, 'isBaseRepositoryPrototype')
        .mockReturnValue(true);

      const dynamicModule = TransactionModule.setRepository([TestRepository]);

      expect(dynamicModule.providers).toStrictEqual([
        {
          provide: TestRepository,
          useFactory: expect.any(Function),
          inject: [ALS_SERVICE],
        },
      ]);
      expect(dynamicModule.exports).toStrictEqual([TestRepository]);
      expect(
        (dynamicModule.providers?.[0] as FactoryProvider).useFactory(),
      ).toStrictEqual(new TestRepository());
    });

    it('For TypeORM Entities classes, a useFactory that injects TransactionRepository through TypeORM Repository Token must be configured.', async () => {
      const dynamicModule = TransactionModule.setRepository([User]);

      expect(dynamicModule.providers).toStrictEqual([
        {
          provide: getRepositoryToken(User),
          useFactory: expect.any(Function),
          inject: [ALS_SERVICE],
        },
      ]);
      expect(dynamicModule.exports).toStrictEqual([getRepositoryToken(User)]);
    });

    it('Otherwise, an error must be returned', () => {
      expect(() => TransactionModule.setRepository([UserV1Service])).toThrow(
        new Error(
          'This property cannot be registered as a Repository through setRepository ' +
            JSON.stringify(UserV1Service),
        ),
      );
    });
  });
});
