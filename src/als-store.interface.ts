import { QueryRunner } from 'typeorm';

export interface AlsStore {
  queryRunner?: QueryRunner;
}
