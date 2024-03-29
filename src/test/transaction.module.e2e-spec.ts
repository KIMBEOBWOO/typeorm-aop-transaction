import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource } from 'typeorm';
import { PROPAGATION } from '../const/propagation';
import { AlsStore } from '../interfaces/als-store.interface';
import { ALS_SERVICE } from '../symbols/als-service.symbol';
import { getCreateUserDto } from './fixture/data/test-data';
import { CreateUserDto } from './fixture/dtos/create-user.dto';
import { AppModule } from './fixture/modules/app.module';
import { POSTGRES_CONNECTION } from './fixture/modules/database.module';
import { mockQueryLogger } from './fixture/services/typeorm-logger';
import { UserV1Service } from './fixture/services/user.v1.service';

describe('Tranaction Module', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userV1Service: UserV1Service;
  let alsService: AsyncLocalStorage<AlsStore>;

  let dto1: CreateUserDto;
  let dto2: CreateUserDto;

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

    userV1Service = app.get<UserV1Service>(UserV1Service);
    alsService = app.get(ALS_SERVICE);

    dto1 = getCreateUserDto(1);
    dto2 = getCreateUserDto(2);

    Object.assign(mockQueryLogger, {
      info: jest.fn(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be define', () => {
    expect(app).toBeDefined();
    expect(dataSource).toBeDefined();
    expect(userV1Service).toBeDefined();
    expect(alsService).toBeDefined();

    expect(dto1).toBeDefined();
    expect(dto2).toBeDefined();
  });

  describe('REQUIRED', () => {
    it('부모 트랜잭션이 없거나 참여 불가능한 트랜잭션인 경우 새로운 트랜잭션을 만들어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createRequried(dto1);

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it(`참여 가능한 부모 트랜잭션이 존재할 경우 해당 트랜잭션에 참여해야한다.`, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createRequried(dto1, {
          afterCallback: async () => {
            await userV1Service.createRequried(dto2);
          },
        });

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it('부모 트랜잭션내에서 오류가 발생할 경우 모두 롤백되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            // Parent transaction
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                // Child transaction
                await userV1Service.createRequried(dto2);

                // 오류 반환
                throw new Error(
                  'PARENT ERROR - after child trasnsaction finished',
                );
              },
            }),
        ).rejects.toThrow(
          new Error('PARENT ERROR - after child trasnsaction finished'),
        );

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        expect(userList).toStrictEqual([]);
      });
    });

    it('자식 트랜잭션내에서 오류가 발생할 경우 모두 롤백되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            // Parent transaction
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                // Child transaction
                await userV1Service.createRequried(dto2, {
                  afterCallback: async () => {
                    // 오류 반환
                    throw new Error(
                      'CHILDEN ERROR - after child trasnsaction finished',
                    );
                  },
                });
              },
            }),
        ).rejects.toThrow(
          new Error('CHILDEN ERROR - after child trasnsaction finished'),
        );

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        expect(userList).toStrictEqual([]);
      });
    });
  });

  describe('REQUIRES_NEW', () => {
    it('부모 트랜잭션이 진행 중인 경우 트랜잭션을 보류시키고 새로운 트랜잭션을 만들어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'COMMIT',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createRequried(dto1, {
          afterCallback: async () =>
            await userV1Service.createRequriesNew(dto2),
        });

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it('부모 트랜잭션에서 오류가 발생한 경우 자신은 정상적으로 커밋되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'COMMIT',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                await userV1Service.createRequriesNew(dto2);

                throw new Error('Parent Error!');
              },
            }),
        ).rejects.toThrow(new Error('Parent Error!'));

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const [user] = await userV1Service.findAll();
        expect(user).toMatchObject({
          id: expect.any(Number),
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
          deleted_at: null,
          ...getCreateUserDto(2),
        });
      });
    });

    it('스스로의 트랜잭션내에서 오류가 발생한 경우 스스로만 롤백되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                await userV1Service.createRequriesNew(dto2, {
                  afterCallback: async () => {
                    return new Promise((_, rejects) =>
                      rejects(new Error('Children Error!')),
                    );
                  },
                });
              },
            }),
        ).rejects.toThrow(new Error('Children Error!'));

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const [user] = await userV1Service.findAll();
        expect(user).toMatchObject({
          id: expect.any(Number),
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
          deleted_at: null,
          ...getCreateUserDto(1),
        });
      });
    });
  });

  describe('NESTED', () => {
    it(`부모 트랜잭션이 없거나 참여 불가능한 트랜잭션인 경우 새로운 트랜잭션을 만들어야한다.`, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createNested(dto1);

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();

        userList.forEach((user) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(1),
          });
        });
      });
    });

    it(`참여가능한 트랜잭션이 진행 중인 경우 트랜잭션을 중첩시킨다.`, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'SAVEPOINT typeorm_1',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'RELEASE SAVEPOINT typeorm_1',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createRequried(dto1, {
          afterCallback: async () => {
            await userV1Service.createNested(dto2);
          },
        });

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();

        expect(userList.length).toBe(2);
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it(`자신의 트랜잭션에서 오류가 발생할 경우 스스로만 롤백시킨다.`, async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'SAVEPOINT typeorm_1',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK TO SAVEPOINT typeorm_1',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        try {
          await userV1Service.createRequried(dto1, {
            afterCallback: async () => {
              try {
                await userV1Service.createNested(dto2, {
                  afterCallback: async () => {
                    throw new Error('NESTED ERROR');
                  },
                });
              } catch (e) {
                expect(e).toBeInstanceOf(Error);
              }
            },
          });
        } catch (e) {
          expect(e).not.toBeInstanceOf(Error);
          expect(e).toMatchObject(new Error('NESTED ERROR'));
        }

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();

        expect(userList.length).toBe(1);
        userList.forEach((user) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(1),
          });
        });
      });
    });
  });

  describe('NEVER', () => {
    it('부모 트랜잭션이 진행 중인 경우 오류를 반환해야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                await userV1Service.createNever(dto2);
              },
            }),
        ).rejects.toThrow(
          new Error(
            'Attempting to join a transaction in progress. Methods with NEVER properties cannot run within a transaction boundary',
          ),
        );

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        expect(userList.length).toBe(0);
      });
    });

    it('부모 트랜잭션이 진행 중이 아닌 경우 쿼리러너를 생성해 쿼리만을 실행한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createNever(dto1);

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });
  });

  describe('SUPPORTS', () => {
    it('부모 트랜잭션이 없는 경우 트랜잭션 없이 쿼리만 실행한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createSupports(dto1);

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it('부모 트랜잭션이 참여 불가능한 트랜잭션인 경우 트랜잭션 없이 쿼리만 실행한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        queryRunner: dataSource.createQueryRunner(),
        parentPropagtionContext: {
          [PROPAGATION.REQUIRES_NEW]: true,
        },
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createSupports(dto1);

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it('참여 가능한 부모 트랜잭션이 존재할 경우 해당 트랜잭션에 참여해야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        await userV1Service.createRequried(dto1, {
          afterCallback: async () => {
            await userV1Service.createSupports(dto2);
          },
        });

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        userList.forEach((user, idx) => {
          expect(user).toMatchObject({
            id: expect.any(Number),
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
            deleted_at: null,
            ...getCreateUserDto(idx + 1),
          });
        });
      });
    });

    it('부모 트랜잭션내에서 오류가 발생할 경우 모두 롤백되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            // Parent transaction
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                // Child transaction
                await userV1Service.createSupports(dto2);

                // 오류 반환
                throw new Error(
                  'PARENT ERROR - after child trasnsaction finished',
                );
              },
            }),
        ).rejects.toThrow(
          new Error('PARENT ERROR - after child trasnsaction finished'),
        );

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        expect(userList).toStrictEqual([]);
      });
    });

    it('자식 트랜잭션내에서 오류가 발생할 경우 모두 롤백되어야한다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK',
      ];

      await alsService.run(store, async () => {
        await expect(
          async () =>
            // Parent transaction
            await userV1Service.createRequried(dto1, {
              afterCallback: async () => {
                // Child transaction
                await userV1Service.createSupports(dto2, {
                  afterCallback: async () => {
                    // 오류 반환
                    throw new Error(
                      'CHILDEN ERROR - after child trasnsaction finished',
                    );
                  },
                });
              },
            }),
        ).rejects.toThrow(
          new Error('CHILDEN ERROR - after child trasnsaction finished'),
        );

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        expect(userList).toStrictEqual([]);
      });
    });
  });

  describe('Testing nested transactions', () => {
    it('부모 트랜잭션이 REQUIRES_NEW 인 경우 자신의 오류로 인해 부모 트랜잭션이 롤백되어서는 안된다.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      const log = jest.spyOn(mockQueryLogger, 'info');
      const expectedTransactionLogs = [
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id1","test user password1","test email1","test phone number1"]',
        'START TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
        'INSERT INTO "user"("created_at", "updated_at", "deleted_at", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["test user id2","test user password2","test email2","test phone number2"]',
        'ROLLBACK',
        'COMMIT',
      ];

      await alsService.run(store, async () => {
        try {
          await userV1Service.createRequriesNew(dto1, {
            afterCallback: async () => {
              try {
                await userV1Service.createRequried(dto2, {
                  afterCallback: () => {
                    throw new Error('Child Error');
                  },
                });
              } catch (e) {
                // 부모가 롤백되어서는 안되므로 NotRollbackError 를 던져야한다.
                expect(e).toBeInstanceOf(Error);
                throw e;
              }
            },
          });
        } catch (e) {
          // 부모 또한 REQUIRES_NEW 이므로 자신의 에러를 NotRollbackError 로 처리해야한다.
          expect(e).toBeInstanceOf(Error);
        }

        expectedTransactionLogs.forEach((expectedLog, idx) => {
          expect(log).toHaveBeenNthCalledWith(idx + 1, expectedLog);
        });

        const userList = await userV1Service.findAll();
        expect(userList.length).toBe(1);
        expect(userList[0]).toMatchObject({
          id: expect.any(Number),
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
          deleted_at: null,
          ...getCreateUserDto(1),
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('The error thrown by the target method should be returned as it is.', async () => {
      const store: AlsStore = {
        _id: Date.now().toString(),
        parentPropagtionContext: {},
      };
      class TestError extends Error {}

      try {
        await alsService.run(store, async () => {
          await userV1Service.createNested(dto1, {
            afterCallback: async () => {
              throw new TestError('TEST ERROR');
            },
          });
        });
      } catch (e) {
        expect(e).toBeInstanceOf(TestError);
      }
    });
  });

  describe('BullQueue Intergration', () => {
    it('If the task registered in the message queue is a method with @Transactional applied, it should be executed as a root transaction', async () => {
      await userV1Service.addJob();
    });
  });
});
