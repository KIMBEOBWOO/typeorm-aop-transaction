<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [Outline](#outline)
- [Initialization](#initialization)
  - [step 1](#step-1)
  - [step 2-1 (with Custom repository)](#step-2-1-with-custom-repository)
  - [step 2-2 (without Custom repository)](#step-2-2-without-custom-repository)
  - [step 3](#step-3)
- [Propagations](#propagations)
  - [REQUIRES_NEW](#requires_new)
  - [REQUIRED](#required)
  - [NESTED](#nested)
  - [NEVER](#never)
  - [SUPPORTS](#supports)
- [Logging](#logging)
- [Future Support Plan](#future-support-plan)
- [Test Coverage](#test-coverage)
- [Referenced Libraries](#referenced-libraries)

<!-- /code_chunk_output -->

<br/>

## Outline

In Nest.js, the library allows for the establishment of TypeORM Transaction boundaries via AOP. This approach to transactional business logic takes inspiration from the Spring Framework's non-invasive methodology. There is a good library called [typeorm-transactional-cls-hooked](https://www.npmjs.com/package/typeorm-transactional-cls-hooked) but it is not compatible with `typeorm 0.3^` or higher.

We used [@toss/aop](https://www.npmjs.com/package/@toss/nestjs-aop) for AOP implementation and it is compatible with custom AOP decoder implemented using that library. In addition, much of the code in the [typeorm-transactional-cls-hooked](https://www.npmjs.com/package/typeorm-transactional-cls-hooked) library was referenced to implement the Spring Transaction Synchronization Pool. Internally, use Nest.js's [AsyncStorage](https://docs.nestjs.com/recipes/async-local-storage) to manage resources in TypeORM during the request lifecycle.

<br/>

## Initialization

### step 1

To use this library, you must register the Transaction Module with the App Module.

```tsx
import { MiddlewareConsumer, Module } from '@nestjs/common';
import {
  TransactionMiddleware,
  TransactionModule,
} from 'typeorm-aop-transaction';

@Module({
  imports: [TransactionModule.regist()],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TransactionMiddleware).forRoutes('*');
  }
}
```

<br />

If you used the connection name when registering a TypeORM Module, you must enter it in the `defaultConnectionName` property.
The `defaultConnectionName` is the `name` that you defined when you initialized the TypeORM module, DataSource.

```tsx
// app.module.ts
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { TransactionModule } from 'typeorm-aop-transaction';
import { TransactionMiddleware } from 'typeorm-aop-transaction';

@Module({
  imports: [
    TransactionModule.regist({
      defaultConnectionName: 'POSTGRES_CONNECTION', // <-- set specific typeorm connection name
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

...

// (example) database.module.ts
@Module({
  imports: [
    // Postgres Database
    TypeOrmModule.forRootAsync({
      name: 'POSTGRES_CONNECTION', // <-- using this connection name
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

<br/>

### step 2-1 (with Custom repository)

Add the `@CustomTransactionRepository` decorator to dynamically register the Custom Repository using the Transaction Module. _(be changed v.1.3.0^)_

```tsx
import { CustomTransactionRepository } from 'typeorm-aop-transaction';
import { BaseRepository } from 'typeorm-aop-transaction';

@CustomTransactionRepository(User) // <-- add this Decorator
@Injectable()
export class UserRepository extends BaseRepository<User> {}
```

**If you want to specify a Repository Token explicitly, pass it to the second parameter.**

```tsx
@CustomTransactionRepository(User, USER_REPOSITORY_TOKEN) // <-- add this Decorator
@Injectable()
export class UserRepository extends BaseRepository<User> {}
```

**You can use the setRepository static method to register a CustomRepository as a provider.**

```tsx
@Module({
  imports: [TransactionModule.setRepository([UserRepository])], // <-- register a CustomRepository
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

<br/>

### step 2-2 (without Custom repository)

**If you are not using Custom Repository, you can register and use the Entity class.**

```tsx
@Module({
  imports: [TransactionModule.setRepository([User])], // <-- regist a Entity Class
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

**In this case, it must be injected from the service class using the supplied InjectTransactionRepository decorator.**

```tsx
@Injectable()
export class UserService {
  constructor(
    @InjectTransactionRepository(User) // <-- add this decorator
    private readonly userRepository: UserRepository,
  ) {}
  ...
```

<br/>

### step 3

Use `@Transactionl` to apply AOP at the method level of the Service Class.

```tsx
@Injectable()
export class UserService {
  constructor(
    @InjectTransactionRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Transactional()
  async create(dto: CreateUserDto): Promise<void> {
    const user = this.userMapper.to(User, dto);

    await this.userRepository.insert(user);
  }

  @Transactional({
    propagation: PROPAGATION.SUPPORTS
  })
  async findAll(): Promise<User[]> {
    const user = await this.userRepository.find({
      order: {
        created_at: 'DESC',
      },
    });

    return user;
  }
```

The currently supported proposals are "REQUIRES_NEW", "REQUIRED", “NESETED”, “NEVER” and isolationLevel supports all isolation levels provided at the TypeORM level.

<br/>

## Propagations

Currently supported transaction propagation levels are **_REQUIRES_NEW, REQUIRED, NESTED, NEVER and SUPPORTS_**
`@Transactional` default propagation option is **_REQUIRED_**.

<br/>

### REQUIRES_NEW

`REQUIRES_NEW` propagation level starts a new transaction regardless of the existence of a parent transaction. Moreover, this newly started transaction is committed or rolled back independently of the nested or parent transaction. Here is an example for better understanding.

In the `create` method that has the `REQUIRES_NEW` propagation level, the `create2` method with the `REQUIRED` propagation level is being executed and an error occurs during the execution of the `create2` method. `create2` is **rolled back** and `create` is **committed**, and as a result, the **Error is thrown out of the Service Class**.

```bash
[Nest] 23598  - 2023. 06. 18. 오후 5:56:06   DEBUG [Transactional] 1687078566046|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRES_NEW - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["2ce-26531b27f5e8","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]
[Nest] 23598  - 2023. 06. 18. 오후 5:56:06   DEBUG [Transactional] 1687078566046|POSTGRES_CONNECTION|create2|READ COMMITTED|REQUIRED - New Transaction

query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["f4b-55aadba0508b","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]
query: ROLLBACK

query: COMMIT
[Nest] 23598  - 2023. 06. 18. 오후 5:56:06   ERROR [ExceptionsHandler] test
```

In this case, the method `create2` with the `REQUIRES_NEW` propagation level is being executed within the `create` method with the `REQUIRED` propagation level, and an error occurs during the execution of the `create2` method. In this case, the result of the `create2` method with the `REQUIRES_NEW` propagation attribute is **committed** instead of being **rolled back.**

```bash
[Nest] 24146  - 2023. 06. 18. 오후 6:06:06   DEBUG [Transactional] 1687079166691|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRED - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["89f-ff92d6554359","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]

[Nest] 24146  - 2023. 06. 18. 오후 6:06:06   DEBUG [Transactional] 1687079166691|POSTGRES_CONNECTION|create2|READ COMMITTED|REQUIRES_NEW - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["7a3-cce699b7f065","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]
query: COMMIT

query: ROLLBACK
[Nest] 24146  - 2023. 06. 18. 오후 6:06:06   ERROR [ExceptionsHandler] test
```

<br/>

### REQUIRED

The default propagation level is `REQUIRED`. If set to `REQUIRED`, transaction boundary settings depend heavily on the existence of a parent transaction. If there is already an ongoing transaction, it participates in the transaction without starting a new one. If there is no ongoing transaction, a new transaction is started.

In the `create` method, which has been set to a `REQUIRED` propagation level, an error occurs while the `create2` method, which has been set to a `REQUIRED` propagation level, is executed. Since they behave like a single transaction, both are rolled back.

```bash
[Nest] 24304  - 2023. 06. 18. 오후 6:10:53   DEBUG [Transactional] 1687079453250|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRED - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["4ed-be402112bcde","wjdrms15!","qjqdn1568@naver.com","+82-10-3252-2568"]
[Nest] 24304  - 2023. 06. 18. 오후 6:10:53   DEBUG [Transactional] 1687079453250|POSTGRES_CONNECTION|create2|READ COMMITTED|REQUIRED - Join Transaction
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["2cd-d3159145e24a","wjdrms15!","2222 qjqdn1568@naver.com","+82-10-3252-2568"]

query: ROLLBACK
[Nest] 24304  - 2023. 06. 18. 오후 6:10:53   ERROR [ExceptionsHandler] test
```

<br/>

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
query: ROLLBACK TO SAVEPOINT typeorm_1

query: COMMIT
[Nest] 24502  - 2023. 06. 18. 오후 6:15:43   ERROR [ExceptionsHandler] test
```

<br/>

### NEVER

If the `NEVER` propagation option is set, it defaults to returning an error if a parent transaction exists.

```tsx
[Nest] 15178  - 2023. 07. 02. 오후 5:35:17   DEBUG [Transactional] 1688286917592|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRED - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["c2d-5b8df90d6607","wjdrms15!","qjqdn1568@naver.comxx","+82-10-3252-2568"]
query: ROLLBACK
**[Nest] 15178  - 2023. 07. 02. 오후 5:35:17   ERROR [ExceptionsHandler] Attempting to join a transaction in progress. Methods with NEVER properties cannot run within a transaction boundary**
Error: Attempting to join a transaction in progress. Methods with NEVER properties cannot run within a transaction boundary
    at AlsTransactionDecorator.<anonymous> (/Users/beobwoo/dev/beebee/server/node_modules/typeorm-aop-transaction/src/providers/als-transaction.decorator.ts:305:15)
    at Generator.throw (<anonymous>)
    at rejected (/Users/beobwoo/dev/beebee/server/node_modules/typeorm-aop-transaction/dist/providers/als-transaction.decorator.js:18:65)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
```

If the `NEVER` propagation option is normally processable, **it does not create a transaction it only executes SQL queries.**

```tsx
[Nest] 15328  - 2023. 07. 02. 오후 5:36:42   DEBUG [Transactional] 1688287002875|POSTGRES_CONNECTION|findAll|READ COMMITTED|NEVER - No Transaction
query: SELECT "*" FROM "user" "User" WHERE "User"."deleted_at" IS NULL ORDER BY "User"."created_at" DESC
```

<br/>

### SUPPORTS

If the `SUPPORTS` transaction option is set and the parent transaction does not exist, it behaves the same as the `NEVER` propagation option. Therefore, **it only runs SQL Query without any transactions.**

```tsx
[Nest] 15328  - 2023. 07. 02. 오후 5:36:42   DEBUG [Transactional] 1688287002875|POSTGRES_CONNECTION|findAll|READ COMMITTED|NEVER - No Transaction
query: SELECT "*" FROM "user" "User" WHERE "User"."deleted_at" IS NULL ORDER BY "User"."created_at" DESC
```

If the parent transaction is in progress and is available to participate, it will behave the same way as the `REQUIRED` propagation option. Therefore, **participate in transactions in progress.**

```tsx
[Nest] 15831  - 2023. 07. 02. 오후 5:41:09   DEBUG [Transactional] 1688287269077|POSTGRES_CONNECTION|create|READ COMMITTED|NESTED - New Transaction
query: START TRANSACTION
query: SET TRANSACTION ISOLATION LEVEL READ COMMITTED
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["b0f-a42a40a6ba7f","wjdrms15!","qjqdn1568@naver.comxx","+82-10-3252-2568"]
[Nest] 15831  - 2023. 07. 02. 오후 5:41:09   DEBUG [Transactional] 1688287269077|POSTGRES_CONNECTION|create2|READ COMMITTED|**SUPPORTS - Join Transaction // <-- join**
query: INSERT INTO "user"("created_at", "updated_at", "deleted_at", "id", "user_id", "password", "email", "phone_number") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, $1, $2, $3, $4) RETURNING "created_at", "updated_at", "deleted_at", "id" -- PARAMETERS: ["42b-d4bbdccc8c9a","wjdrms15!","2222 qjqdn1568@naver.comxx","+82-10-3252-2568"]
query: COMMIT
```

<br/>

## Logging

If you want to log the generation and participation of transactions according to the propagation option, pass the `logging` property with the TransactionModule.regist call factor. The default log level is the `log`.

```tsx
@Module({
  imports: [
    TransactionModule.regist({
      logging: 'debug', // logging level
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

// (example) console logging
[Nest] 20212  - 2023. 07. 24. 오후 11:29:57   DEBUG [Transactional] 1690208997228|POSTGRES_CONNECTION|findAll|READ COMMITTED|REQUIRED - New Transaction
[Nest] 20212  - 2023. 07. 24. 오후 11:46:05   DEBUG [Transactional] 1690209965305|POSTGRES_CONNECTION|create|READ COMMITTED|REQUIRED - New Transaction
```

<br/>

## Future Support Plan

- _add propagation option : ~~NESTED~~, NOT_SUPPORTED, ~~SUPPORTS~~, ~~NEVER~~, MANDATORY_
- _~~add Unit Test~~_
- _~~add integration test~~_
- _add Rollback, Commit Callback Hooks_
- ~~_remove Loggers_~~

<br/>

## Test Coverage

| File                                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s |
| ------------------------------------------ | ------- | -------- | ------- | ------- | ----------------- |
| All files                                  | 100     | 100      | 100     | 100     |
| src                                        | 100     | 100      | 100     | 100     |
| base.repository.ts                         | 100     | 100      | 100     | 100     |
| src/const                                  | 100     | 100      | 100     | 100     |
| custom-repository-metadata.ts              | 100     | 100      | 100     | 100     |
| propagation.ts                             | 100     | 100      | 100     | 100     |
| src/decorators                             | 100     | 100      | 100     | 100     |
| custom-transaction-repository.decorator.ts | 100     | 100      | 100     | 100     |
| inject-transaction-repository.decorator.ts | 100     | 100      | 100     | 100     |
| transactional.decorator.ts                 | 100     | 100      | 100     | 100     |
| src/exceptions                             | 100     | 100      | 100     | 100     |
| not-rollback.error.ts                      | 100     | 100      | 100     | 100     |
| src/modules                                | 100     | 100      | 100     | 100     |
| transaciton.module.ts                      | 100     | 100      | 100     | 100     |
| src/providers                              | 100     | 100      | 100     | 100     |
| als-transaction.decorator.ts               | 100     | 100      | 100     | 100     |
| data-source-map.service.ts                 | 100     | 100      | 100     | 100     |
| transaction.logger.ts                      | 100     | 100      | 100     | 100     |
| transaction.middleware.ts                  | 100     | 100      | 100     | 100     |
| transaction.service.ts                     | 100     | 100      | 100     | 100     |
| src/symbols                                | 100     | 100      | 100     | 100     |
| als-service.symbol.ts                      | 100     | 100      | 100     | 100     |
| data-source-map.service.symbol.ts          | 100     | 100      | 100     | 100     |
| transaciton-module-option.symbol.ts        | 100     | 100      | 100     | 100     |
| transaction-decorator.symbol.ts            | 100     | 100      | 100     | 100     |
| src/test/mocks                             | 100     | 100      | 100     | 100     |
| als.service.mock.ts                        | 100     | 100      | 100     | 100     |
| discovery.service.mock.ts                  | 100     | 100      | 100     | 100     |
| transaction-module-option.mock.ts          | 100     | 100      | 100     | 100     |
| src/utils                                  | 100     | 100      | 100     | 100     |
| is-base-repository-prototype.ts            | 100     | 100      | 100     | 100     |
| is-typeorm-entity.ts                       | 100     | 100      | 100     | 100     |

<br/>

## Referenced Libraries

- [https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md](https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md)
