import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Workspace } from '../entities/workspace.entity';
import { TypeORMLogger } from '../services/typeorm-logger';

export const POSTGRES_CONNECTION = 'POSTGRES_CONNECTION';

@Module({
  imports: [
    // Postgres Database
    TypeOrmModule.forRoot({
      name: POSTGRES_CONNECTION,
      type: 'postgres',
      host: '127.0.0.1',
      port: 5433,
      username: 'beobwoo',
      password: 'testtest',
      database: 'test_db',
      synchronize: false,
      // Entity file path (always consider dockerfile)
      entities: [User, Workspace],
      // logging: ['query'],
      // logger: 'simple-console',
      logger: new TypeORMLogger(['query']),
    }),
  ],
  providers: [],
})
export class DatabaseModule {}
