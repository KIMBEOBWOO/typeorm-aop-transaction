## O**utline**

In Nest.js, the library allows for the establishment of TypeORM Transaction boundaries via AOP. This approach to transactional business logic takes inspiration from the Spring Framework's non-invasive methodology. There is a good library called [typeorm-transactional-cls-hooked](https://www.npmjs.com/package/typeorm-transactional-cls-hooked) but it is not compatible with `typeorm 0.3^` or higher.

We used [@toss/aop](https://www.npmjs.com/package/@toss/nestjs-aop) for AOP implementation and it is compatible with custom AOP decoder implemented using that library. In addition, much of the code in the [typeorm-transactional-cls-hooked](https://www.npmjs.com/package/typeorm-transactional-cls-hooked) library was referenced to implement the Spring Transaction Synchronization Pool.

**I**nternally, use Nest.js's [AsyncStorage](https://docs.nestjs.com/recipes/async-local-storage) to manage resources in TypeORM during the request lifecycle.

## Installation

```bash
npm install --save typeorm-aop-transaction
```

Or

```bash
yarn add typeorm-aop-transaction
```

## **Initialization**

### step 1

To use this library, you must register the Transaction Module with the App Module.

```tsx
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { TransactionModule } from 'typeorm-aop-transaction';
import { TransactionMiddleware } from 'typeorm-aop-transaction';

@Module({
  imports: [
    TransactionModule.regist({
      defaultConnectionName: 'POSTGRES_CONNECTION',
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TransactionMiddleware).forRoutes('*');
  }
}
```

The defaultConnectionName is the connectionName that you defined when you initialized the TypeORM module, DataSource.

```tsx
// example
@Module({
  imports: [
    // Postgres Database
    TypeOrmModule.forRootAsync({
      name: POSTGRES_CONNECTION,
      inject: [ConfigService<IsPostgresDatabaseConfig>],
      useFactory: (
        configService: ConfigService<IsPostgresDatabaseConfig, true>,
      ) => ({
        ...
      }),
    }),
  ],
  providers: [],
})
export class DatabaseModule {}
```

### step 2

**Inherits the Base Repository provided when defining the Repository to use.**

```tsx
import { Injectable } from '@nestjs/common';
import { User } from 'src/database/entities/user.entity';
import { BaseRepository } from 'typeorm-aop-transaction';

@Injectable()
export class UserRepository extends BaseRepository<User> {}
```

It works in a way that overrides the EntityManger internally, so you can use all the functions of the existing repository.

### step 3

Inject with useFactory on the module where the corresponding Repository should be injected.

@NOTE This part will be improved later.

```tsx
@Module({
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: USER_MODULE_INJECTOR.USER_REPOSITORY,
      useFactory: (alsService: AsyncLocalStorage<AlsStore>) => {
        return new UserRepository(User, alsService);
      },
      inject: [AsyncLocalStorage],
    },
  ],
})
export class UserModule {}
```

### step 4

Use @Transactionl to apply AOP at the method level of the Service Class.

```tsx
import { Inject, Injectable } from '@nestjs/common';
import { User } from 'src/database/entities/user.entity';
import { Mapper } from 'src/mapper/mapper.interfaces';
import { DeleteResult, Repository } from 'typeorm';
import { USER_MODULE_INJECTOR } from './common/user.injector';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Transactional } from 'typeorm-aop-transaction';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_MODULE_INJECTOR.USER_REPOSITORY)
    private readonly userRepository: Repository<User>,
		...
  ) {}

  @Transactional({
    propagation: 'REQUIRES_NEW',
  })
  async create(dto: CreateUserDto): Promise<void> {
    const user = this.userMapper.to(User, dto);

    await this.userRepository.insert(user);
  }

  @Transactional()
  async findAll(): Promise<User[]> {
    const user = await this.userRepository.find({
      order: {
        created_at: 'DESC',
      },
    });

    return user;
  }
```

The currently supported proposals are "REQUIRES_NEW", "REQUIRED", and isolationLevel supports all isolation levels provided at the TypeORM level.

## Propagations

Currently supported transaction propagation levels are REQUIRES_NEW, REQUIRED, NESTED, and NEVER.

### REQUIRES_NEW

`REQUIRES_NEW` propagation level starts a new transaction regardless of the existence of a parent transaction. Moreover, this newly started transaction is committed or rolled back independently of the nested or parent transaction. Here is an example for better understanding.

`REQUIRES_NEW` propagation level starts a new transaction regardless of the existence of a parent transaction. Moreover, this newly started transaction is committed or rolled back independently of the nested or parent transaction. Here is an example for better understanding.

In the `create` method that has the `REQUIRES_NEW` propagation level, the `create2` method with the `REQUIRED` propagation level is being executed and an error occurs during the execution of the `create2` method. `create2` is **rolled back** and `create` is **committed**, and as a result, the **Error is thrown out of the Service Class**.

```bash
[Nest] 23598  - 2023. 06. 18. 오후 5:56:06   DEBUG [Transactional] 1687078566046|POSTGRES_CONNECTION|**create**|READ COMMITTED|**REQUIRES_NEW** - New Transaction
**query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED**
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["2ce-26531b27f5e8","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]
[Nest] 23598  - 2023. 06. 18. 오후 5:56:06   DEBUG [Transactional] 1687078566046|POSTGRES_CONNECTION|**create2**|READ COMMITTED|**REQUIRED** - New Transaction

**query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED**
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["f4b-55aadba0508b","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]
**query: ROLLBACK

query: COMMIT**
[Nest] 23598  - 2023. 06. 18. 오후 5:56:06   ERROR [ExceptionsHandler] test
```

In this case, the method `create2` with the `REQUIRES_NEW` propagation level is being executed within the `create` method with the `REQUIRED` propagation level, and an error occurs during the execution of the `create2` method. In this case, the result of the `create2` method with the `REQUIRES_NEW` propagation attribute is **committed** instead of being **rolled back.**

```bash
[Nest] 24146  - 2023. 06. 18. 오후 6:06:06   DEBUG [Transactional] 1687079166691|POSTGRES_CONNECTION|**create**|READ COMMITTED|**REQUIRED** - New Transaction
**query: START TRANSACTION**
**query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED**
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["89f-ff92d6554359","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]

[Nest] 24146  - 2023. 06. 18. 오후 6:06:06   DEBUG [Transactional] 1687079166691|POSTGRES_CONNECTION|**create2**|READ COMMITTED|**REQUIRES_NEW** - New Transaction
**query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED**
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["7a3-cce699b7f065","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]
**query: COMMIT**

**query: ROLLBACK**
[Nest] 24146  - 2023. 06. 18. 오후 6:06:06   ERROR [ExceptionsHandler] test
```

### REQUIRED

The default propagation level is `REQUIRED`. If set to `REQUIRED`, transaction boundary settings depend heavily on the existence of a parent transaction. If there is already an ongoing transaction, it participates in the transaction without starting a new one. If there is no ongoing transaction, a new transaction is started.

In the `create` method, which has been set to a `REQUIRED` propagation level, an error occurs while the `create2` method, which has been set to a `REQUIRED` propagation level, is executed. Since they behave like a single transaction, both are rolled back.

```bash
[Nest] 24304  - 2023. 06. 18. 오후 6:10:53   DEBUG [Transactional] 1687079453250|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRED - New Transaction
**query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED**
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["4ed-be402112bcde","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]
[Nest] 24304  - 2023. 06. 18. 오후 6:10:53   DEBUG [Transactional] 1687079453250|POSTGRES_CONNECTION|create2|READ COMMITTED|REQUIRED - Join Transaction
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["2cd-d3159145e24a","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]

**query: ROLLBACK**
[Nest] 24304  - 2023. 06. 18. 오후 6:10:53   ERROR [ExceptionsHandler] test
```

### NESTED

This propagation option is very similar to `REQUIRED`, but there is a difference when the parent transaction exists. In this case, it does not simply participate in the transaction, but sets a savepoint before executing its query. If an error occurs, it **rolls back** only up to the **savepoint it set,** so the **parent transaction is** **committed** normally.

If there is a **NESTED** propagation method `create2` inside the parent method `create` with the `REQUIRED` propagation level, and an error occurs during the execution of `create2`, `create2` saves a **savepoint** before executing its query. If an error occurs, it rolls back only up to the **savepoint** it set, so the insert by the parent method is normally committed.

```bash
[Nest] 24502  - 2023. 06. 18. 오후 6:15:43   DEBUG [Transactional] 1687079743116|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRED - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["615-1bbae146a294","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]
[Nest] 24502  - 2023. 06. 18. 오후 6:15:43   DEBUG [Transactional] 1687079743116|POSTGRES_CONNECTION|create2|READ COMMITTED|NESTED - Make savepiont, Wrap Transaction

query: SAVEPOINT typeorm_1
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["1b9-d065db5d0bc4","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]
**query: ROLLBACK TO SAVEPOINT typeorm_1**

query: COMMIT
[Nest] 24502  - 2023. 06. 18. 오후 6:15:43   ERROR [ExceptionsHandler] test
```

### NEVER

It will be updated later.

## **Future Support Plan**

- add propagation option : ~~NESTED~~, NOT_SUPPORTED, SUPPORTS, ~~NEVER~~, MANDATORY
- add Unit Test
- add integration test
- add Rollback, Commit Callback Hooks
- ~~remove Loggers~~

## R**eferenced Libraries**

- [https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md](https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md)
