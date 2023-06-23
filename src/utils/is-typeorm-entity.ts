import { EntityTarget, getMetadataArgsStorage } from 'typeorm';

export const isTypeORMEntity = (target: unknown): target is EntityTarget<any> =>
  typeof target === 'function' &&
  getMetadataArgsStorage().tables.find((table) => table.target === target) !==
    undefined;
