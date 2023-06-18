# typeorm-transactional-cls-hooked

[![npm version](http://img.shields.io/npm/v/typeorm-transactional-cls-hooked.svg?style=flat)](https://npmjs.org/package/typeorm-aop-transaction 'View this project on npm')

# typeorm-aop-transaction

Assign: 법우
Created time: 2023년 6월 13일 오후 11:38
Status: NestJs

## Outline

The library provides functionality for setting TypeORM Transaction boundaries through AOP in Nest.js. Inspired by a non-invasive transactional approach to business logic using the Spring Framework's `@TransactionalDecorator.`

There is a good library called [typeorm-transactional-cls-hooked](https://www.npmjs.com/package/typeorm-transactional-cls-hooked) but it is not compatible with `typeorm 0.3^` or higher.

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

## **Future Support Plan**

- add propagation option : NESTED, NOT_SUPPORTED, SUPPORTS, NEVER, MANDATORY
- add Unit Test
- add integration test
- add Rollback, Commit Callback Hooks
- remove Loggers

## R**eferenced Libraries**

- [https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md](https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md)
