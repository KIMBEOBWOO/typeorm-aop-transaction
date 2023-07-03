import { getRepositoryToken } from '@nestjs/typeorm';
import { BaseRepository } from '../../base.repository';
import { CustomTransactionRepository } from '../../decorators/custom-transaction-repository.decorator';
import { TransactionModule } from '../../modules/transaciton.module';
import { ALS_SERVICE } from '../../symbols/als-service.symbol';
import { User } from '../fixture/entities/user.entity';
import { UserV1Service } from '../fixture/services/user.v1.service';

describe('TransactionModule', () => {
  describe('setRepository', () => {
    it('In the case of a Custom Repository class that inherits the Base Repository, a useFactory that injects the Transaction Repository through metadata applied with the Custom Transaction Repository decoder must be configured.', async () => {
      @CustomTransactionRepository(User, 'Test Repository Token')
      class TestRepository extends BaseRepository<User> {}

      const dynamicModule = TransactionModule.setRepository([TestRepository]);

      expect(dynamicModule.providers).toStrictEqual([
        {
          provide: 'Test Repository Token',
          useFactory: expect.any(Function),
          inject: [ALS_SERVICE],
        },
      ]);
      expect(dynamicModule.exports).toStrictEqual(['Test Repository Token']);
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
