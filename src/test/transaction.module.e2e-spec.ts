import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AopModule } from '@toss/nestjs-aop';
import { TransactionModule } from '../modules/transaciton.module';

const POSTGRES_CONNECTION = 'POSTGRES_CONNECTION';

describe('Tranaction Module', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        AopModule,
        // Postgres Database
        TypeOrmModule.forRoot({
          name: POSTGRES_CONNECTION,
          type: 'postgres',
          host: '127.0.0.1',
          port: 5432,
          username: 'beobwoo',
          password: 'testtest',
          database: 'test_db',
          synchronize: false,
          // Entity file path (always consider dockerfile)
          entities: [],
          logging: 'all',
        }),
        TransactionModule.regist({
          defaultConnectionName: POSTGRES_CONNECTION,
        }),
      ],
      providers: [],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('', () => {
    //
  });
});
