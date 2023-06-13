import { Logger } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { AsyncLocalStorage } from 'async_hooks';
import { EntityTarget, QueryRunner, Repository } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TransactionOptions } from './transaction-option.interface';
import { Propagation } from './propagation';
import { TRANSACTION_DECORATOR } from './transaction-decorator.symbol';
import { TypeORMTransactionService } from './transaction.service';
import { AlsStore } from './als-store.interface';

@Aspect(TRANSACTION_DECORATOR)
export class AlsTransactionDecorator
  implements LazyDecorator<any, TransactionOptions>
{
  constructor(
    private readonly alsService: AsyncLocalStorage<AlsStore>,
    private readonly transactionService: TypeORMTransactionService,
  ) {}

  wrap({ metadata, method, methodName }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      // 커넥션 선택 설정
      const connectionName = metadata?.connectionName;

      // 전파 옵션 설정
      const propagation: Propagation =
        metadata?.propagation === undefined ? 'REQUIRED' : metadata.propagation;

      // 고립 수준 설정
      const isolationLevel: IsolationLevel =
        metadata?.isolationLevel === undefined
          ? 'READ COMMITTED'
          : metadata?.isolationLevel;

      const store = this.alsService.getStore();

      if (propagation === 'REQUIRED') {
        // 쿼리러너 설정
        const queryRunner: QueryRunner =
          store?.queryRunner ||
          this.transactionService.createConnection(connectionName);

        // 트랜잭션 진행 여부 조회
        const isTransactionActive = queryRunner.isTransactionActive;

        if (isTransactionActive) {
          // 이미 진행 중인 트랜잭션이 존재, 참여
          Logger.debug(methodName, 'start ' + propagation + ' origin');

          return this.transactionService.runInTransaction(method, args);
        } else {
          // 진행 중인 트랜잭션이 없음, 생성
          Logger.debug(methodName, 'start ' + propagation + ' new');

          return this.alsService.run(
            { ...this.alsService.getStore(), queryRunner: queryRunner },
            () => {
              return this.transactionService.wrapByTransaction(
                method,
                args,
                queryRunner,
                isolationLevel,
              );
            },
          );
        }
      } else if (propagation === 'REQUIRES_NEW') {
        // 진행 중인 모든 트랜잭션을 보류하고 새롭게 시작
        Logger.debug(methodName, 'start ' + propagation + ' new');

        const queryRunner =
          this.transactionService.createConnection(connectionName);

        return this.alsService.run(
          { ...this.alsService.getStore(), queryRunner: queryRunner },
          () => {
            return this.transactionService.wrapByTransaction(
              method,
              args,
              queryRunner,
              isolationLevel,
            );
          },
        );
      }
      throw new Error('사용할 수 없는 전파 옵션 ' + metadata?.propagation);
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
  ) {
    Object.defineProperty(repositoryPrototype, 'manager', {
      get() {
        const queryRunner = store.getStore()?.queryRunner;

        if (queryRunner === undefined) {
          throw new Error('QueryRunner 가 존재하지 않습니다.');
        }

        return queryRunner.manager.getRepository(targetEntity).manager;
      },
    });
  }
}
