import { AsyncLocalStorage } from 'async_hooks';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { AlsTransactionDecorator } from './providers/als-transaction.decorator';

export abstract class BaseRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  constructor(
    public readonly target: EntityTarget<T>,
    private readonly alsService: AsyncLocalStorage<any>,
  ) {
    super(target, null as never);
    AlsTransactionDecorator.setUpBaseRepository(this, target, this.alsService);
  }
}
