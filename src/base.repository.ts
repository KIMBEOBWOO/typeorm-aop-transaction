import { AsyncLocalStorage } from 'async_hooks';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { AlsStore } from './interfaces/als-store.interface';
import { AlsTransactionDecorator } from './providers/als-transaction.decorator';

export class BaseRepository<T extends ObjectLiteral> extends Repository<T> {
  constructor(
    public readonly target: EntityTarget<T>,
    private readonly alsService: AsyncLocalStorage<AlsStore>,
  ) {
    super(target, null as never);
    AlsTransactionDecorator.setUpBaseRepository(this, target, this.alsService);
  }
}
