import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from './fixture/modules/app.module';
import { POSTGRES_CONNECTION } from './fixture/modules/database.module';

describe('Tranaction Module', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
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
