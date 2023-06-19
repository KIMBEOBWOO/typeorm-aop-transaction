import { EntityTarget } from 'typeorm';

export const isTypeORMEntity = (target: unknown): target is EntityTarget<any> =>
  typeof target === 'function';
