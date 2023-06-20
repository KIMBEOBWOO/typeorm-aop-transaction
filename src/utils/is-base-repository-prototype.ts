import { BaseRepository } from '../base.repository';
import { BaseRepositoryConstructor } from '../interfaces/base-repository-constructor.interface';

export const isBaseRepositoryPrototype = (
  target: unknown,
): target is BaseRepositoryConstructor =>
  typeof target === 'function' && target !== null
    ? Reflect.getPrototypeOf(target) === BaseRepository
    : false;
