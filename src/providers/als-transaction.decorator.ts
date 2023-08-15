import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager, EntityTarget, Repository } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TransactionOptions } from '../interfaces/transaction-option.interface';
import { PROPAGATION, Propagation } from '../const/propagation';
import { TRANSACTION_DECORATOR } from '../symbols/transaction-decorator.symbol';
import { TypeORMTransactionService } from './transaction.service';
import { AlsStore } from '../interfaces/als-store.interface';
import { TransactionLogger } from './transaction.logger';
import { Inject } from '@nestjs/common';
import { ALS_SERVICE } from '../symbols/als-service.symbol';

@Aspect(TRANSACTION_DECORATOR)
export class AlsTransactionDecorator
  implements LazyDecorator<any, TransactionOptions>
{
  constructor(
    @Inject(ALS_SERVICE)
    private readonly alsService: AsyncLocalStorage<AlsStore>,
    private readonly transactionService: TypeORMTransactionService,
    private readonly logger: TransactionLogger,
  ) {}

  wrap({ metadata, method, methodName }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      const store = this.alsService.getStore();

      if (!store) {
        throw new Error(
          'AlsTransactionDecorator requires async storage to be initialized. Please check if TransactionMiddleware is registered as a consumer in the root module',
        );
      }

      const {
        // 스토어에 포함된 쿼리러너 확인
        queryRunner: storeQueryRunner,
        // 상위에 NESTED 가 있는지 확인
        parentPropagtionContext,
      } = store;

      // 커넥션 선택 설정
      const connectionName = metadata?.connectionName;

      // 전파 옵션 설정
      const propagation: Propagation =
        metadata?.propagation === undefined ? 'REQUIRED' : metadata.propagation;

      // 고립 수준 설정
      const isolationLevel: IsolationLevel =
        metadata?.isolationLevel === undefined
          ? 'READ COMMITTED'
          : metadata.isolationLevel;

      try {
        if (propagation === PROPAGATION.REQUIRED) {
          if (
            storeQueryRunner &&
            storeQueryRunner.isTransactionActive &&
            !parentPropagtionContext[PROPAGATION.REQUIRES_NEW] // 현재 컨텍스트가 REQUIRES_NEW 가 아니어야한다.
          ) {
            this.logger.debug(
              'Join Transaction',
              store._id,
              storeQueryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return this.transactionService.runInTransaction(method, args);
          } else {
            // 진행중인 트랜잭션이 없으므로 새롭게 생성
            const queryRunner =
              this.transactionService.createConnection(connectionName);

            this.logger.debug(
              'New Transaction',
              store._id,
              queryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return await this.alsService.run(
              {
                // 스토어 쿼리러너 세팅
                _id: store._id,
                queryRunner: queryRunner,
                parentPropagtionContext: {
                  [propagation]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
                },
              },
              async () => {
                return await this.transactionService.wrapByTransaction(
                  method,
                  args,
                  queryRunner,
                  isolationLevel,
                );
              },
            );
          }
        } else if (propagation === PROPAGATION.REQUIRES_NEW) {
          // 진행 중인 모든 트랜잭션을 보류하고 새롭게 시작
          const queryRunner =
            this.transactionService.createConnection(connectionName);

          this.logger.debug(
            'New Transaction',
            store._id,
            queryRunner.connection.name,
            methodName,
            isolationLevel,
            propagation,
          );

          return await this.alsService.run(
            {
              // 스토어 쿼리러너 세팅
              _id: store._id,
              queryRunner: queryRunner,
              parentPropagtionContext: {
                [propagation]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
              },
            },
            async () => {
              return await this.transactionService.wrapByTransaction(
                method,
                args,
                queryRunner,
                isolationLevel,
              );
            },
          );
        } else if (propagation === PROPAGATION.NESTED) {
          if (
            storeQueryRunner &&
            storeQueryRunner.isTransactionActive &&
            !parentPropagtionContext[PROPAGATION.REQUIRES_NEW] // 현재 컨텍스트가 REQUIRES_NEW 가 아니어야한다.
          ) {
            this.logger.debug(
              'Make savepiont, Wrap Transaction',
              store._id,
              storeQueryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return await this.alsService.run(
              {
                // 스토어 쿼리러너 세팅 (기존 쿼리러너 사용)
                _id: store._id,
                queryRunner: storeQueryRunner,
                parentPropagtionContext: {
                  [propagation]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
                },
              },
              async () => {
                return await this.transactionService.wrapByTransaction(
                  method,
                  args,
                  storeQueryRunner,
                  isolationLevel,
                  true,
                );
              },
            );
          } else {
            // 진행중인 트랜잭션이 없으므로 새롭게 생성
            const queryRunner =
              this.transactionService.createConnection(connectionName);

            this.logger.debug(
              'New Transaction',
              store._id,
              queryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return await this.alsService.run(
              {
                // 스토어 쿼리러너 세팅
                _id: store._id,
                queryRunner: queryRunner,
                parentPropagtionContext: {
                  [propagation]: true, // REQUIRES_NEW 가 부모에 진행중임을 설정
                },
              },
              async () => {
                return await this.transactionService.wrapByTransaction(
                  method,
                  args,
                  queryRunner,
                  isolationLevel,
                );
              },
            );
          }
        } else if (propagation === PROPAGATION.NEVER) {
          if (storeQueryRunner) {
            throw new Error(
              'Attempting to join a transaction in progress. Methods with NEVER properties cannot run within a transaction boundary',
            );
          } else {
            // 빈 쿼리러너이므로 새로 세팅
            const notTransactionalQueryRunner =
              this.transactionService.createConnection(connectionName);

            this.logger.debug(
              'Without Transaction',
              store._id,
              notTransactionalQueryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return await this.alsService.run(
              {
                _id: store._id,
                queryRunner: notTransactionalQueryRunner,
                parentPropagtionContext: {
                  [propagation]: true,
                },
              },
              async () => {
                try {
                  return await this.transactionService.runInTransaction(
                    method,
                    args,
                  );
                } finally {
                  await notTransactionalQueryRunner.release();
                }
              },
            );
          }
        } else if (propagation === PROPAGATION.SUPPORTS) {
          if (
            storeQueryRunner &&
            storeQueryRunner.isTransactionActive &&
            !parentPropagtionContext[PROPAGATION.REQUIRES_NEW]
          ) {
            /** Join Transaction */
            this.logger.debug(
              'Join Transaction',
              store._id,
              storeQueryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return this.transactionService.runInTransaction(method, args);
          } else {
            /** Without Transaction */
            const notTransactionalQueryRunner =
              this.transactionService.createConnection(connectionName);

            this.logger.debug(
              'Without Transaction',
              store._id,
              notTransactionalQueryRunner.connection.name,
              methodName,
              isolationLevel,
              propagation,
            );

            return await this.alsService.run(
              {
                _id: store._id,
                queryRunner: notTransactionalQueryRunner,
                parentPropagtionContext: {
                  [propagation]: true,
                },
              },
              async () => {
                try {
                  return await this.transactionService.runInTransaction(
                    method,
                    args,
                  );
                } finally {
                  await notTransactionalQueryRunner.release();
                }
              },
            );
          }
        } else {
          throw new Error(
            `Propagation(${metadata.propagation}) option not supported yet.`,
          );
        }
      } catch (e) {
        if (
          // 상위 진행되고 있는 트랜잭션이 REQUIRES_NEW 인 경우 내가 던진 에러는 롤백하면 안됨
          parentPropagtionContext?.[PROPAGATION.REQUIRES_NEW] ||
          // 현재 진행 중인 트랜잭션이 REQUIRES_NEW 인 경우
          metadata?.propagation === PROPAGATION.REQUIRES_NEW ||
          // 현재 진행 중인 트랜잭션이 NESTED 이고 부모 트랜잭션이 있는 경우(중첩) 내가 던진 에러는 롤백하면 안됨
          metadata?.propagation === PROPAGATION.NESTED
        ) {
          e._not_rollback = true;
          throw e;
        }

        throw e;
      }
    };
  }

  /**
   * 베이스 레파지토리 설정 변경
   * @param repositoryPrototype 레파지토리 클래스 프로토타입
   */
  static setUpBaseRepository(
    repositoryPrototype: ThisType<Repository<any>>,
    targetEntity: EntityTarget<any>,
    store: AsyncLocalStorage<AlsStore>,
    entityManger?: EntityManager,
  ) {
    Object.defineProperty(repositoryPrototype, 'manager', {
      get() {
        if (entityManger) {
          return entityManger.getRepository(targetEntity).manager;
        }

        const queryRunner = store.getStore()?.queryRunner;

        if (queryRunner === undefined) {
          throw new Error(
            'QueryRunner does not exist. @Transactional Access to the database running internally should only be via the Repository method that inherits the Base Repository.',
          );
        }

        return queryRunner.manager.getRepository(targetEntity).manager;
      },
    });
  }
}
