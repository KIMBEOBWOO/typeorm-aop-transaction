import { BaseRepository } from '../base.repository';
import { BaseRepositoryConstructor } from '../interfaces/base-repository-constructor.interface';

export const isBaseRepositoryPrototype = (
  target: any,
): target is BaseRepositoryConstructor =>
  Reflect.getPrototypeOf(target) === BaseRepository<any>;
