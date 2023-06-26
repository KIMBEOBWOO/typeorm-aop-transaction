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
import { UserV1Service } from './fixture/services/user.v1.service';

describe('Tranaction Module', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userService: UserService;
  let userV1Service: UserV1Service;
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
    jest.restoreAllMocks();

    dataSource = app.get<DataSource>(getDataSourceToken(POSTGRES_CONNECTION));
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.query('TRUNCATE "user", "workspace" CASCADE');
    } finally {
      await queryRunner.release();
    }

    userService = app.get<UserService>(UserService);
    userV1Service = app.get<UserV1Service>(UserV1Service);
    alsService = app.get(ALS_SERVICE);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be define', () => {
    expect(app).toBeDefined();
    expect(dataSource).toBeDefined();
    expect(userService).toBeDefined();
    expect(userV1Service).toBeDefined();
    expect(alsService).toBeDefined();
  });

  describe(`REQUIRED`, () => {
    it(`부모 트랜잭션이 없거나 참여 불가능한 트랜잭션인 경우 새로운 트랜잭션을 만들어야한다.`, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(console, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password","test email","test phone number"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id","test user password","test email","test phone number"]',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userService.create(
          new CreateUserDto({
            email: 'test email',
            user_id: 'test user id',
            password: 'test user password',
            phone_number: 'test phone number',
          }),
        );

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(
            idx + 1,
            expect.stringContaining('query'),
            expectedLog,
          );
        });

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

    it(`중첩된 트랜잭션내에서 오류가 발생할 경우 둘다 롤백되야한다.`, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(console, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'ROLLBACK',
      ];
      jest.spyOn(userService, 'create2').mockRejectedValue(new Error('test'));

      await alsService.run(store, async () => {
        await expect(
          async () =>
            await userService.create(
              new CreateUserDto({
                email: 'test email',
                user_id: 'test user id',
                password: 'test user password',
                phone_number: 'test phone number',
              }),
            ),
        ).rejects.toThrow(new Error('test'));

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(
            idx + 1,
            expect.stringContaining('query'),
            expectedLog,
          );
        });

        const userList = await userService.findAll();
        expect(userList).toStrictEqual([]);
      });
    });
  });

  describe(`REQUIRES_NEW`, () => {
    it('진행 중인 트랜잭션을 보류시키고 새로운 트랜잭션을 만들어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(console, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id","test user password","test email","test phone number"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password","test email","test phone number"]',
        'COMMIT',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        const dto = new CreateUserDto({
          email: 'test email',
          user_id: 'test user id',
          password: 'test user password',
          phone_number: 'test phone number',
        });

        await userV1Service.createRequried(dto, {
          afterCallback: async () =>
            await userV1Service.createRequriesNew({
              ...dto,
              user_id: dto.user_id + '2',
            }),
        });

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(
            idx + 1,
            expect.stringContaining('query'),
            expectedLog,
          );
        });

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

    it('부모 트랜잭션에서 오류가 발생한 경우 REQURIES_NEW 트랜잭션은 정상적으로 커밋되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(console, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id","test user password","test email","test phone number"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password","test email","test phone number"]',
        'COMMIT',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        const dto = new CreateUserDto({
          email: 'test email',
          user_id: 'test user id',
          password: 'test user password',
          phone_number: 'test phone number',
        });

        await expect(
          async () =>
            await userV1Service.createRequried(dto, {
              afterCallback: async () => {
                await userV1Service.createRequriesNew({
                  ...dto,
                  user_id: dto.user_id + '2',
                });

                throw new Error('Parent Error!');
              },
            }),
        ).rejects.toThrow(new Error('Parent Error!'));

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(
            idx + 1,
            expect.stringContaining('query'),
            expectedLog,
          );
        });

        const [user] = await userService.findAll();
        expect(user).toMatchObject({
          id: expect.any(Number),
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
          deleted_at: null,
          user_id: 'test user id2',
          email: 'test email',
          password: 'test user password',
          phone_number: 'test phone number',
        });
      });
    });

    it('자신의 트랜잭션에서 오류가 발생한 경우 스스로만 롤백되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(console, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id","test user password","test email","test phone number"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password","test email","test phone number"]',
        'ROLLBACK',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        const dto = new CreateUserDto({
          email: 'test email',
          user_id: 'test user id',
          password: 'test user password',
          phone_number: 'test phone number',
        });

        await expect(
          async () =>
            await userV1Service.createRequried(dto, {
              afterCallback: async () => {
                await userV1Service.createRequriesNew(
                  {
                    ...dto,
                    user_id: dto.user_id + '2',
                  },
                  {
                    afterCallback: async () => {
                      return new Promise((_, rejects) =>
                        rejects(new Error('Children Error!')),
                      );
                    },
                  },
                );
              },
            }),
        ).rejects.toThrow(new Error('Children Error!'));

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(
            idx + 1,
            expect.stringContaining('query'),
            expectedLog,
          );
        });

        const [user] = await userService.findAll();
        expect(user).toMatchObject({
          id: expect.any(Number),
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
          deleted_at: null,
          user_id: 'test user id',
          email: 'test email',
          password: 'test user password',
          phone_number: 'test phone number',
        });
      });
    });
  });
});
