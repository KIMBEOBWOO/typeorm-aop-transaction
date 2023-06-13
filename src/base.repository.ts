import { AsyncLocalStorage } from 'async_hooks';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { AlsTransactionDecorator } from './als-transaction.decorator';

export abstract class BaseRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  constructor(
    public readonly target: EntityTarget<T>,
    private readonly alsService: AsyncLocalStorage<any>,
  ) {
    /**
     * @NOTE 트랜잭션 데코레이터를 사용하지 않는 메서드를 위해 기본 상속은 지켜야한다.
     */
    super(target, null as never);
    AlsTransactionDecorator.setUpBaseRepository(this, target, this.alsService);
  }
}
