import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { AopModule } from '@toss/nestjs-aop';
import { DataSource } from 'typeorm';
import { TransactionModule } from '../modules/transaciton.module';
import { User } from './fixture/entities/user.entity';
import { Workspace } from './fixture/entities/workspace.entity';

const POSTGRES_CONNECTION = 'POSTGRES_CONNECTION';

describe('Tranaction Module', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
          entities: [User, Workspace],
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

    dataSource = module.get<DataSource>(
      getDataSourceToken(POSTGRES_CONNECTION),
    );

    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.query('TRUNCATE "user", "workspace" CASCADE');
    } finally {
      await queryRunner.release();
    }
  });

  it('should be define', () => {
    expect(app).toBeDefined();
    expect(dataSource).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('', () => {
    //
  });
});
