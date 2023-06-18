import { QueryRunner } from 'typeorm';

export interface ParentPropagationContext {
  [key: string]: boolean;
}

export interface AlsStore {
  _id: string;
  queryRunner?: QueryRunner;
  parentPropagtionContext: ParentPropagationContext;
}
