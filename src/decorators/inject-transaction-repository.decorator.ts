import { Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';

export const InjectTransactionRepository = (entity: EntityClassOrSchema) =>
  Inject(getRepositoryToken(entity));
