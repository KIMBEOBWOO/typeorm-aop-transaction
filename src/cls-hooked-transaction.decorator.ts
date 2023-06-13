import { Logger } from '@nestjs/common';
import { createNamespace, getNamespace, Namespace } from 'cls-hooked';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { QueryRunner, Repository } from 'typeorm';

import { TransactionOptions } from './transaction-option.interface';
import { Propagation } from './propagation';
import { TRANSACTION_DECORATOR } from './transaction-decorator.symbol';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TypeORMTransactionService } from './transaction.service';

@Aspect(TRANSACTION_DECORATOR)
export class ClsHookedTransactinoDecorator
  implements LazyDecorator<any, TransactionOptions>
{
  static readonly NAMESPACE_NAME = 'TX'; // 트랜잭션 네임스페이스 이름
  static readonly QUERY_RUNNER_PRERIX = 'queryRunner'; // 트랜잭션 컨텍스트 쿼리러너 키 접두사

  constructor(private readonly transactionService: TypeORMTransactionService) {
    getNamespace(ClsHookedTransactinoDecorator.NAMESPACE_NAME) ||
      createNamespace(ClsHookedTransactinoDecorator.NAMESPACE_NAME); // cls-hooked context 초기화
  }

  /**
   * 트랜잭션 Proxy 메서드
   */
  wrap({ metadata, method, methodName }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      const txNamespace = ClsHookedTransactinoDecorator.getTxNamespace();

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

      // 트랜잭션 네임스페이스로 위임 대상 메서드 랩핑
      return txNamespace.runAndReturn(async () => {
        if (propagation === 'REQUIRED') {
          // 쿼리러너 설정
          const queryRunner: QueryRunner =
            ClsHookedTransactinoDecorator.getTxQueryRunner(txNamespace) ||
            this.transactionService.createConnection(connectionName); // 존재하지 않는 경우 새로 생성해 초기화

          // 트랜잭션 진행 여부 조회
          const isTransactionActive = queryRunner.isTransactionActive;

          if (isTransactionActive) {
            // 이미 진행 중인 트랜잭션이 존재, 참여
            Logger.debug(methodName, 'start ' + propagation + ' origin');

            return this.transactionService.runInTransaction(method, args);
          } else {
            // 진행 중인 트랜잭션이 없음, 생성
            Logger.debug(methodName, 'start ' + propagation + ' new');

            // 진행 중인 트랜잭션이 없으므로 설정
            ClsHookedTransactinoDecorator.setTxQueryRunner(
              queryRunner,
              txNamespace,
            );

            return this.transactionService.wrapByTransaction(
              method,
              args,
              queryRunner,
              isolationLevel,
            );
          }
        } else if (propagation === 'REQUIRES_NEW') {
          // 진행 중인 모든 트랜잭션을 보류하고 새롭게 시작
          Logger.debug(methodName, 'start ' + propagation + ' new');

          const queryRunner =
            this.transactionService.createConnection(connectionName);
          return this.transactionService.wrapByTransaction(
            method,
            args,
            queryRunner,
            isolationLevel,
          );
        } else {
          throw new Error('사용할 수 없는 전파 옵션 ' + metadata?.propagation);
        }
      });
    };
  }

  /**
   * 트랜잭션 cls-hooked 네임스페이스 getter
   * @returns Namespace, 요청 수명주기를 가지는 트랜잭션 네임스페이스
   */
  static getTxNamespace(): Namespace {
    const txNamespace: Namespace | undefined = getNamespace(
      ClsHookedTransactinoDecorator.NAMESPACE_NAME,
    );

    if (txNamespace === undefined) {
      throw new Error(
        ClsHookedTransactinoDecorator.NAMESPACE_NAME + ' 이 초기화되지않음.',
      );
    }

    return txNamespace;
  }

  /**
   * 트랜잭션 컨텍스트에 저장된 쿼리러너 getter
   * @param _txNamespace Namespace
   * @returns QueryRunner | undefined
   */
  static getTxQueryRunner(_txNamespace?: Namespace): QueryRunner | undefined {
    const txNamespace =
      _txNamespace || ClsHookedTransactinoDecorator.getTxNamespace();

    const queryRunner: QueryRunner | undefined = txNamespace.get(
      ClsHookedTransactinoDecorator.QUERY_RUNNER_PRERIX,
    );

    return queryRunner;
  }

  /**
   * 트랜잭션 컨텍스트에 쿼리러너 저장
   * @param queryRunner QueryRunner
   * @param _txNamespace Namespace
   * @returns QueryRunner
   */
  static setTxQueryRunner(
    queryRunner: QueryRunner,
    _txNamespace?: Namespace,
  ): QueryRunner {
    const txNamespace =
      _txNamespace || ClsHookedTransactinoDecorator.getTxNamespace();

    return txNamespace.set(
      ClsHookedTransactinoDecorator.QUERY_RUNNER_PRERIX,
      queryRunner,
    );
  }

  /**
   * 베이스 레파지토리 설정 변경
   * @param repositoryPrototype 레파지토리 클래스 프로토타입
   */
  static setUpBaseRepository(repositoryPrototype: ThisType<Repository<any>>) {
    Object.defineProperty(repositoryPrototype, 'manager', {
      get() {
        const queryRunner = ClsHookedTransactinoDecorator.getTxQueryRunner();

        if (queryRunner === undefined) {
          throw new Error('쿼리러너가 존재하지 않음. 쿼리 실행 불가능');
        }

        return queryRunner.manager;
      },
      set(manager: any) {
        this._manager = manager;
      },
    });
  }
}
