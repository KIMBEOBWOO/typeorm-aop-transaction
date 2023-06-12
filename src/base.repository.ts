import {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { ClsHookedTransactinoDecorator } from './cls-hooked-transaction.decorator';

export abstract class BaseRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  constructor(
    public readonly target: EntityTarget<T>,
    public readonly entityManager: EntityManager,
  ) {
    /**
     * @NOTE 트랜잭션 데코레이터를 사용하지 않는 메서드를 위해 기본 상속은 지켜야한다.
     */
    super(target, entityManager);
    ClsHookedTransactinoDecorator.setUpBaseRepository(this);
  }
}
