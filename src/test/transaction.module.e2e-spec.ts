import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource } from 'typeorm';
import { AlsStore } from '../interfaces/als-store.interface';
import { ALS_SERVICE } from '../symbols/als-service.symbol';
import { CreateUserDto } from './fixture/dtos/create-user.dto';
import { AppModule } from './fixture/modules/app.module';
import { POSTGRES_CONNECTION } from './fixture/modules/database.module';
import { UserService } from './fixture/services/user.service';

describe('Tranaction Module', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userService: UserService;
  let alsService: AsyncLocalStorage<AlsStore>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      providers: [],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    dataSource = app.get<DataSource>(getDataSourceToken(POSTGRES_CONNECTION));

    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.query('TRUNCATE "user", "workspace" CASCADE');
    } finally {
      await queryRunner.release();
    }

    userService = app.get<UserService>(UserService);
    alsService = app.get(ALS_SERVICE);
  });

  it('should be define', () => {
    expect(app).toBeDefined();
    expect(dataSource).toBeDefined();
    expect(userService).toBeDefined();
    expect(alsService).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * 1. 부모 트랜잭션이 참여 가능한 트랜잭션인 경우 올바르게 참여하는지 검증
   *  1-1. 잘 참여해서 커밋 되는지
   *  1-2. 같이 롤백 되는지
   * 2. 부모 트랜잭션이 없거나 참여 불가능한 트랜잭션인 경우 올바르게 새로운 트랜잭션을 만드는지 검증
   *  2-1. 새롭게 트랜잭션을 만들어서 커밋을 하는지
   *  2-2. 스스로 롤백을 잘하는지
   */
  describe(`REQUIRED`, () => {
    it(`
  부모 트랜잭션이 없거나 참여 불가능한 트랜잭션인 경우 새로운 트랜잭션을 만들어야한다.
    `, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };

      const consoleLog = jest.spyOn(console, 'info');

      await alsService.run(store, async () => {
        await userService.create(
          new CreateUserDto({
            email: 'test email',
            user_id: 'test user id',
            password: 'test user password',
            phone_number: 'test phone number',
          }),
        );

        expect(consoleLog).toHaveBeenNthCalledWith(
          1,
          'query:',
          'START TRANSACTION',
        );
        expect(consoleLog).toHaveBeenNthCalledWith(
          2,
          'query:',
          'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        );
        expect(consoleLog).toHaveBeenNthCalledWith(
          3,
          'query:',
          'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password","test email","test phone number"]',
        );
        expect(consoleLog).toHaveBeenNthCalledWith(
          4,
          'query:',
          'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id","test user password","test email","test phone number"]',
        );
        expect(consoleLog).toHaveBeenNthCalledWith(5, 'query:', 'COMMIT');

        const userList = await userService.findAll();

        userList.forEach((user) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            user_id: expect.any(String),
            email: 'test email',
            password: 'test user password',
            phone_number: 'test phone number',
          });
        });
      });
    });
  });
});
