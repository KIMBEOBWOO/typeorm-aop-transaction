import { FactoryProvider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomTransactionRepository } from '../../decorators/custom-transaction-repository.decorator';
import { TransactionModule } from '../../modules/transaciton.module';
import { ALS_SERVICE } from '../../symbols/als-service.symbol';
import * as RepositoryUtil from '../../utils/is-base-repository-prototype';
import { User } from '../fixture/entities/user.entity';
import { UserV1Service } from '../fixture/services/user.v1.service';

describe('TransactionModule', () => {
  beforeEach(() => jest.restoreAllMocks());

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
