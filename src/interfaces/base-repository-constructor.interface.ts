import { AsyncLocalStorage } from 'async_hooks';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { AlsStore } from './als-store.interface';

export interface BaseRepositoryConstructor<T extends ObjectLiteral = any> {
  new (
    target: EntityTarget<T>,
    alsService: AsyncLocalStorage<AlsStore>,
  ): BaseRepository<T>;
}
